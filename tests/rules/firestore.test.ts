import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import {
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  ADMIN_EMAIL,
  authed,
  authedOutsider,
  createTestEnv,
  now,
  seed,
  USERS,
} from "./helpers";

const visAll = { mode: "all" as const };
const visRole = (roles: string[]) => ({ mode: "role_limited" as const, roles });
const visMembers = (memberUids: string[]) => ({
  mode: "member_limited" as const,
  memberUids,
});

const CLIENT_ID = "client-1";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await createTestEnv();
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await seed(env);
});

/** ルール無効でプロジェクトを投入する。 */
async function seedProject(id: string, visibility: object) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "projects", id), {
      clientId: CLIENT_ID,
      name: id,
      visibility,
      isDeleted: false,
      createdAt: now(),
    });
  });
}

/** ルール無効でタスクを投入する。 */
async function seedTask(
  id: string,
  opts: {
    projectId: string;
    visibility: object;
    assignees?: string[];
    createdBy?: string;
  },
) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "tasks", id), {
      projectId: opts.projectId,
      clientId: CLIENT_ID,
      title: id,
      description: "",
      assignees: opts.assignees ?? [],
      dueAt: null,
      status: "not_started",
      priority: "mid",
      visibility: opts.visibility,
      createdBy: opts.createdBy ?? USERS.pm.uid,
      isDeleted: false,
      createdAt: now(),
      updatedAt: now(),
    });
  });
}

function taskPayload(over: Record<string, unknown> = {}) {
  return {
    projectId: "p-all",
    clientId: CLIENT_ID,
    title: "new task",
    description: "",
    assignees: [],
    dueAt: null,
    status: "not_started",
    priority: "mid",
    visibility: visAll,
    createdBy: USERS.member.uid,
    isDeleted: false,
    createdAt: now(),
    updatedAt: now(),
    ...over,
  };
}

// ===========================================================================
describe("認証・ドメイン制限", () => {
  it("ドメイン外アカウントは users を読めない", async () => {
    const db = authedOutsider(env, "x-uid", "x@example.com");
    await assertFails(getDoc(doc(db, "users", USERS.member.uid)));
  });

  it("missions ユーザーは users を読める", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(getDoc(doc(db, "users", USERS.admin.uid)));
  });
});

describe("ユーザー作成とロールのブートストラップ", () => {
  it("初期管理者メールは自分の user を admin で作成できる", async () => {
    const db = authed(env, "boot-admin", ADMIN_EMAIL);
    await env.clearFirestore(); // seed 済み admin を消して自己作成を試す
    await assertSucceeds(
      setDoc(doc(db, "users", "boot-admin"), {
        email: ADMIN_EMAIL,
        displayName: "松本",
        role: "admin",
        createdAt: now(),
      }),
    );
  });

  it("一般ユーザーは自分の user を admin で作成できない", async () => {
    const db = authed(env, "new-uid", "new@missions.co.jp");
    await assertFails(
      setDoc(doc(db, "users", "new-uid"), {
        email: "new@missions.co.jp",
        displayName: "New",
        role: "admin",
        createdAt: now(),
      }),
    );
  });

  it("一般ユーザーは自分の user を member で作成できる", async () => {
    const db = authed(env, "new-uid", "new@missions.co.jp");
    await assertSucceeds(
      setDoc(doc(db, "users", "new-uid"), {
        email: "new@missions.co.jp",
        displayName: "New",
        role: "member",
        createdAt: now(),
      }),
    );
  });

  it("member が自分を admin へ自己昇格できない", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      updateDoc(doc(db, "users", USERS.member.uid), { role: "admin" }),
    );
  });

  it("admin は他ユーザーの role を変更できる", async () => {
    const db = authed(env, USERS.admin.uid, USERS.admin.email);
    await assertSucceeds(
      updateDoc(doc(db, "users", USERS.member.uid), { role: "pm" }),
    );
  });

  it("member は他ユーザーの role を変更できない", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      updateDoc(doc(db, "users", USERS.member2.uid), { role: "pm" }),
    );
  });
});

describe("クライアント（admin のみ）", () => {
  it("admin はクライアントを作成できる", async () => {
    const db = authed(env, USERS.admin.uid, USERS.admin.email);
    await assertSucceeds(
      setDoc(doc(db, "clients", "c1"), {
        name: "Acme",
        isDeleted: false,
        createdAt: now(),
      }),
    );
  });

  it("pm はクライアントを作成できない", async () => {
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertFails(
      setDoc(doc(db, "clients", "c2"), {
        name: "Beta",
        isDeleted: false,
        createdAt: now(),
      }),
    );
  });

  it("missions ユーザーはクライアントを読める", async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "clients", "c1"), {
        name: "Acme",
        isDeleted: false,
        createdAt: now(),
      });
    });
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(getDoc(doc(db, "clients", "c1")));
  });
});

describe("プロジェクトの公開範囲（読み取り）", () => {
  it("all: member が読める", async () => {
    await seedProject("p-all", visAll);
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(getDoc(doc(db, "projects", "p-all")));
  });

  it("role_limited[pm]: member は読めず、pm/admin は読める", async () => {
    await seedProject("p-pm", visRole(["admin", "pm"]));
    await assertFails(
      getDoc(doc(authed(env, USERS.member.uid, USERS.member.email), "projects", "p-pm")),
    );
    await assertSucceeds(
      getDoc(doc(authed(env, USERS.pm.uid, USERS.pm.email), "projects", "p-pm")),
    );
    await assertSucceeds(
      getDoc(doc(authed(env, USERS.admin.uid, USERS.admin.email), "projects", "p-pm")),
    );
  });

  it("member_limited: 指定メンバーのみ読める（admin は常に可）", async () => {
    await seedProject("p-mem", visMembers([USERS.member.uid]));
    await assertSucceeds(
      getDoc(doc(authed(env, USERS.member.uid, USERS.member.email), "projects", "p-mem")),
    );
    await assertFails(
      getDoc(doc(authed(env, USERS.member2.uid, USERS.member2.email), "projects", "p-mem")),
    );
    await assertSucceeds(
      getDoc(doc(authed(env, USERS.admin.uid, USERS.admin.email), "projects", "p-mem")),
    );
  });
});

describe("プロジェクトの作成（pm 以上）", () => {
  it("member は作成できない", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      setDoc(doc(db, "projects", "np"), {
        clientId: CLIENT_ID,
        name: "np",
        visibility: visAll,
        isDeleted: false,
        createdAt: now(),
      }),
    );
  });

  it("pm は作成できる", async () => {
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertSucceeds(
      setDoc(doc(db, "projects", "np2"), {
        clientId: CLIENT_ID,
        name: "np2",
        visibility: visAll,
        isDeleted: false,
        createdAt: now(),
      }),
    );
  });
});

describe("タスクの読み取りと担当者常時アクセス（境界ルール1）", () => {
  it("task all: member が読める", async () => {
    await seedProject("p-all", visAll);
    await seedTask("t-all", { projectId: "p-all", visibility: visAll });
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(getDoc(doc(db, "tasks", "t-all")));
  });

  it("task member_limited: 非対象メンバーは読めない", async () => {
    await seedProject("p-all", visAll);
    await seedTask("t-mem", {
      projectId: "p-all",
      visibility: visMembers([USERS.member.uid]),
    });
    const db = authed(env, USERS.member2.uid, USERS.member2.email);
    await assertFails(getDoc(doc(db, "tasks", "t-mem")));
  });

  it("担当者は visibility 外でも読める（境界ルール1）", async () => {
    await seedProject("p-all", visAll);
    await seedTask("t-assignee", {
      projectId: "p-all",
      visibility: visMembers([USERS.member.uid]), // member2 は含まれない
      assignees: [USERS.member2.uid], // が担当者
    });
    const db = authed(env, USERS.member2.uid, USERS.member2.email);
    await assertSucceeds(getDoc(doc(db, "tasks", "t-assignee")));
  });
});

describe("タスク作成と『狭める方向のみ』（境界ルール2）", () => {
  it("project all のもとで member_limited のタスクを作れる", async () => {
    await seedProject("p-all", visAll);
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-all",
        visibility: visMembers([USERS.member.uid]),
      })),
    );
  });

  it("project role_limited[admin,pm] のもとで role_limited[pm] は許可（部分集合）", async () => {
    await seedProject("p-pm", visRole(["admin", "pm"]));
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertSucceeds(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-pm",
        createdBy: USERS.pm.uid,
        visibility: visRole(["pm"]),
      })),
    );
  });

  it("project role_limited[pm] のもとで all は拒否（広げる方向）", async () => {
    await seedProject("p-pm", visRole(["pm"]));
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertFails(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-pm",
        createdBy: USERS.pm.uid,
        visibility: visAll,
      })),
    );
  });

  it("project member_limited[a,b] のもとで member_limited[a] は許可、[a,c] は拒否", async () => {
    await seedProject("p-mem", visMembers([USERS.member.uid, USERS.member2.uid]));
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-mem",
        createdBy: USERS.member.uid,
        visibility: visMembers([USERS.member.uid]),
      })),
    );
    await assertFails(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-mem",
        createdBy: USERS.member.uid,
        visibility: visMembers([USERS.member.uid, "outsider-uid"]),
      })),
    );
  });

  it("project role_limited[pm] のもとで member_limited は保守的に拒否", async () => {
    await seedProject("p-pm", visRole(["pm"]));
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertFails(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-pm",
        createdBy: USERS.pm.uid,
        visibility: visMembers([USERS.pm.uid]),
      })),
    );
  });

  it("プロジェクトにアクセスできないユーザーはタスクを作れない", async () => {
    await seedProject("p-pm", visRole(["admin", "pm"]));
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      addDoc(collection(db, "tasks"), taskPayload({
        projectId: "p-pm",
        createdBy: USERS.member.uid,
        visibility: visRole(["pm"]),
      })),
    );
  });
});

describe("タスク更新の不変条件", () => {
  it("createdBy を書き換えられない", async () => {
    await seedProject("p-all", visAll);
    await seedTask("t1", { projectId: "p-all", visibility: visAll, createdBy: USERS.member.uid });
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      updateDoc(doc(db, "tasks", "t1"), { createdBy: USERS.member2.uid }),
    );
  });

  it("アクセスできる member はステータスを変更できる", async () => {
    await seedProject("p-all", visAll);
    await seedTask("t2", { projectId: "p-all", visibility: visAll });
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      updateDoc(doc(db, "tasks", "t2"), { status: "in_progress", updatedAt: now() }),
    );
  });

  it("更新時に visibility を project より広げられない", async () => {
    await seedProject("p-pm", visRole(["pm"]));
    await seedTask("t3", { projectId: "p-pm", visibility: visRole(["pm"]), createdBy: USERS.pm.uid });
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertFails(
      updateDoc(doc(db, "tasks", "t3"), { visibility: visAll }),
    );
  });
});

describe("コメント（§3.7）", () => {
  beforeEach(async () => {
    await seedProject("p-all", visAll);
    await seedTask("tc", { projectId: "p-all", visibility: visAll });
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "tasks", "tc", "comments", "cm-member"), {
        parentId: null,
        authorUid: USERS.member.uid,
        body: "hello",
        isDeleted: false,
        createdAt: now(),
      });
    });
  });

  it("本人は自分のコメントを編集できる", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      updateDoc(doc(db, "tasks", "tc", "comments", "cm-member"), {
        body: "edited",
        editedAt: now(),
      }),
    );
  });

  it("他人はコメントを編集できない", async () => {
    const db = authed(env, USERS.member2.uid, USERS.member2.email);
    await assertFails(
      updateDoc(doc(db, "tasks", "tc", "comments", "cm-member"), { body: "hacked" }),
    );
  });

  it("pm は他人のコメントを論理削除できる（body 不変）", async () => {
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertSucceeds(
      updateDoc(doc(db, "tasks", "tc", "comments", "cm-member"), { isDeleted: true }),
    );
  });

  it("pm でも他人のコメント本文は編集できない", async () => {
    const db = authed(env, USERS.pm.uid, USERS.pm.email);
    await assertFails(
      updateDoc(doc(db, "tasks", "tc", "comments", "cm-member"), {
        body: "pm-edit",
      }),
    );
  });

  it("コメント作成時は authorUid が本人でなければ拒否", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      addDoc(collection(db, "tasks", "tc", "comments"), {
        parentId: null,
        authorUid: USERS.member2.uid,
        body: "spoof",
        isDeleted: false,
        createdAt: now(),
      }),
    );
  });
});

describe("添付ファイル（メタ情報 §3.6）", () => {
  beforeEach(async () => {
    await seedProject("p-all", visAll);
    await seedTask("ta", { projectId: "p-all", visibility: visAll });
  });

  const meta = (over: Record<string, unknown> = {}) => ({
    fileName: "a.png",
    storagePath: "task-attachments/ta/x/a.png",
    contentType: "image/png",
    size: 1024,
    uploadedBy: USERS.member.uid,
    createdAt: now(),
    ...over,
  });

  it("許可形式・サイズ内なら作成できる", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      addDoc(collection(db, "tasks", "ta", "attachments"), meta()),
    );
  });

  it("10MB 超は拒否", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      addDoc(collection(db, "tasks", "ta", "attachments"), meta({ size: 11 * 1024 * 1024 })),
    );
  });

  it("許可外の形式は拒否", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      addDoc(collection(db, "tasks", "ta", "attachments"), meta({ contentType: "application/x-msdownload" })),
    );
  });
});

describe("通知（notifications）", () => {
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), "notifications", "n1"), {
        toUid: USERS.member.uid,
        type: "assigned",
        taskId: "t1",
        isRead: false,
        createdAt: now(),
      });
    });
  });

  it("受信者は自分の通知を読める", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(getDoc(doc(db, "notifications", "n1")));
  });

  it("他人の通知は読めない", async () => {
    const db = authed(env, USERS.member2.uid, USERS.member2.email);
    await assertFails(getDoc(doc(db, "notifications", "n1")));
  });

  it("受信者は isRead のみ更新できる", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertSucceeds(
      updateDoc(doc(db, "notifications", "n1"), { isRead: true }),
    );
  });

  it("クライアントから通知を新規作成できない", async () => {
    const db = authed(env, USERS.member.uid, USERS.member.email);
    await assertFails(
      setDoc(doc(db, "notifications", "n2"), {
        toUid: USERS.member.uid,
        type: "assigned",
        taskId: "t9",
        isRead: false,
        createdAt: now(),
      }),
    );
  });
});
