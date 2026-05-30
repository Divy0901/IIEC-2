(function () {
  const STORE_KEY = "iiec-management-system-core";
  const roles = {
    super_admin: "Super Admin",
    admin: "Admin",
    head: "Head",
    joint_head: "Joint Head",
    member: "Member"
  };

  const portfolios = [
    "CORE",
    "DOC & HR",
    "Event & Operation",
    "Creative Design",
    "Technical",
    "Partnership",
    "Content Strategy",
    "Production & Social Media"
  ];

  const profileFields = [
    "phone",
    "studentId",
    "department",
    "year",
    "Contact",
    "linkedin",
    "bio"
  ];

  const memberDefaults = {
    studentId: "",
    department: "",
    year: "",
    Contact: "",
    linkedin: "",
    bio: ""
  };

  // Seed data is completely empty except for your master setup login
  const seed = {
    sheetUrl: "",
    sheetSecret: "",
    activeUserId: null,
    users: [
      {
        id: "u-super",
        name: "IIEC Super Admin",
        email: "superadmin@csmu-iiec.in",
        password: "super123",
        phone: "+91 00000 00000",
        portfolio: "Event & Operation", // Realigned to match updated portfolio lists
        role: "super_admin",
        position: "Faculty Coordinator",
        qrCode: "IIEC-SUPER-MASTER",
        status: "Active",
        studentId: "FAC-001",
        department: "IIEC",
        year: "Coordinator",
        Contact: "+91 00000 00000", // Synchronized property key name
        linkedin: "",
        bio: "Master setup profile used to manually bootstrap the core cell database."
      }
    ],
    meetings: [],
    attendance: [],
    attendanceRequests: [],
    profileRequests: [],
    leaves: []
  };

  let state = load();
  let view = "dashboard";
  let videoStream = null;

  const app = document.getElementById("app");

  function load() {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return normalizeState(structuredClone(seed));
    try {
      return normalizeState({ ...structuredClone(seed), ...JSON.parse(raw) });
    } catch {
      return normalizeState(structuredClone(seed));
    }
  }

  function normalizeState(nextState) {
    nextState.users = (nextState.users || []).map((user) => ({
      ...memberDefaults,
      ...user
    }));
    nextState.meetings = nextState.meetings || [];
    nextState.attendance = nextState.attendance || [];
    nextState.attendanceRequests = nextState.attendanceRequests || [];
    nextState.profileRequests = nextState.profileRequests || [];
    nextState.leaves = nextState.leaves || [];
    return nextState;
  }

  function save() {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }

  function syncSheet(type, payload) {
    if (!state.sheetUrl) return Promise.resolve(false);
    const body = JSON.stringify({
      type,
      payload,
      secret: state.sheetSecret,
      sentAt: new Date().toISOString()
    });
    return fetch(state.sheetUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    }).then(() => true).catch(() => false);
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  // Generates a clean random string for passwords if left blank
  function generateRandomPassword() {
    return "IIEC@" + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.activeUserId);
  }

  function canAdmin(user = currentUser()) {
    return user && ["super_admin", "admin"].includes(user.role);
  }

  function isSuper(user = currentUser()) {
    return user && user.role === "super_admin";
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function qrUrl(value) {
    return `https://quickchart.io/qr?text=${encodeURIComponent(value)}&size=360&margin=2`;
  }

  function formatDate(value) {
    if (!value) return "N/A";
    return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function appNav() {
    const user = currentUser();
    const items = [
      ["dashboard", "Dashboard"],
      ["myqr", "Profile"],
      ["teams", "Teams"],
      ["members", "Members"],
      ["meetings", "Meetings"],
      ["attendance", "Attendance"],
      ["leave", "Leave"],
      ["settings", "Cloud Sync"]
    ].filter(([key]) => {
      if (key === "settings") return isSuper(user);
      if (["meetings", "attendance"].includes(key)) return canAdmin(user);
      return true;
    });
    return items.map(([key, label]) =>
      `<button class="${view === key ? "active" : ""}" data-view="${key}">${label}</button>`
    ).join("");
  }

  function render() {
    stopScanner();
    const user = currentUser();
    if (!user) {
      app.innerHTML = loginTemplate();
      bindLogin();
      return;
    }

    app.innerHTML = `
      <div class="shell">
        <aside class="sidebar">
          <div class="brand">
            <div class="brand-mark">II</div>
            <div>
              <h1>IIEC Workspace</h1>
              <p>Operations & Management</p>
            </div>
          </div>
          <nav class="nav">${appNav()}</nav>
          <div class="profile">
            <strong>${escapeHtml(user.name)}</strong>
            <p>${roles[user.role]} · ${escapeHtml(user.portfolio)}</p>
            <button class="btn secondary" id="logoutBtn" type="button" style="width:100%;margin-top:12px;">Logout</button>
          </div>
        </aside>
        <main class="main">${route()}</main>
      </div>
    `;
    bindShell();
    bindRoute();
  }

  function loginTemplate() {
    return `
      <section class="login-page">
        <form class="login-card" id="loginForm">
          <div class="brand" style="color:var(--ink);margin-bottom:18px;">
            <div class="brand-mark">II</div>
            <div>
              <h1>IIEC Portal</h1>
              <p style="color:var(--muted);">Chhatrapati Shivaji Maharaj University</p>
            </div>
          </div>
          <p>Sign in using your authorized cell credentials.</p>
          <label class="field"><span>Email Address</span><input name="email" type="email" required autocomplete="username"></label>
          <label class="field"><span>Password</span><input name="password" type="password" required autocomplete="current-password"></label>
          <button class="btn" type="submit" style="width:100%;">Sign In</button>
          <p class="notice hide" id="loginError">Invalid email or password combination.</p>
        </form>
      </section>
    `;
  }

  function route() {
    const user = currentUser();
    const headings = {
      dashboard: ["Dashboard Overview", "Real-time metrics, scheduled panels, and cell portfolio diagnostics."],
      myqr: ["Member Profile", "Personal secure credentials, access tokens, and administrative data change requests."],
      teams: ["Strategic Portfolios", "Departmental divisions and portfolio directories."],
      members: ["Roster Directory", "Comprehensive log of roles, classifications, and access permissions."],
      meetings: ["Operations Planning", "Schedule cell assemblies, compile minutes parameters, and push alerts."],
      attendance: ["Verification Control", "Process incoming member tokens and override metrics."],
      leave: ["Absence Logs", "File leave documentation and manage team availability pipelines."],
      settings: ["Data Integrations", "Establish secure synchronization channels with central cloud databases."]
    };
    const [title, subtitle] = headings[view] || headings.dashboard;
    return `
      <div class="topbar">
        <div>
          <h2>${title}</h2>
          <p>${subtitle}</p>
        </div>
        <button class="btn secondary" id="installBtn" type="button">Install to Device</button>
      </div>
      ${view === "dashboard" ? dashboardView() : ""}
      ${view === "myqr" ? myQrView(user) : ""}
      ${view === "teams" ? teamsView() : ""}
      ${view === "members" ? membersView(user) : ""}
      ${view === "meetings" ? meetingsView() : ""}
      ${view === "attendance" ? attendanceView() : ""}
      ${view === "leave" ? leaveView(user) : ""}
      ${view === "settings" ? settingsView() : ""}
    `;
  }

  function dashboardView() {
    const today = new Date().toISOString().slice(0, 10);
    const todayMeetings = state.meetings.filter((meeting) => meeting.date === today).length;
    const present = state.attendance.filter((item) => item.date === today && item.status === "Present").length;
    const pendingLeaves = state.leaves.filter((leave) => leave.status === "Pending").length;
    const pendingChanges = state.attendanceRequests.filter((request) => request.status === "Pending").length;
    const pendingProfiles = state.profileRequests.filter((request) => request.status === "Pending").length;
    return `
      <section class="grid">
        ${metric("Total Personnel", state.users.length, "Registered cell members")}
        ${metric("Daily Agendas", todayMeetings, "Active sessions today")}
        ${metric("Verified Presence", present, "Attended today")}
        ${metric("Pending Action", pendingLeaves + pendingChanges + pendingProfiles, "Requires review")}
        <div class="panel span-6">
          <div class="row between"><h3>Upcoming Sessions</h3><button class="btn secondary" data-view="meetings">View All</button></div>
          ${meetingList(state.meetings.slice(-5).reverse())}
        </div>
        <div class="panel span-6">
          <div class="row between"><h3>Portfolio Distribution</h3><span class="pill">${portfolios.length} Divisions</span></div>
          ${portfolios.map((portfolio) => {
            const members = state.users.filter((user) => user.portfolio === portfolio).length;
            return `<p class="row between"><span>${portfolio}</span><strong>${members}</strong></p>`;
          }).join("")}
        </div>
        <div class="panel span-12">
          <div class="row between"><h3>Structural Status</h3><button class="btn secondary" data-view="teams">Open Teams</button></div>
          <div class="team-grid">${portfolios.map(teamSummaryCard).join("")}</div>
        </div>
      </section>
    `;
  }

  function metric(label, value, sub) {
    return `<div class="panel span-3"><div class="label">${label}</div><div class="metric">${value}</div><div class="label">${sub}</div></div>`;
  }

  function myQrView(user) {
    const myRequests = state.profileRequests.filter((request) => request.userId === user.id);
    return `
      <section class="grid">
        <div class="panel span-5">
          <div class="qr-card">
            <img class="qr-code" src="${qrUrl(user.qrCode)}" alt="ID Access Token">
            <strong>${escapeHtml(user.name)}</strong>
            <span class="pill">${escapeHtml(user.qrCode)}</span>
          </div>
        </div>
        <div class="panel span-7">
          <h3>Personnel File</h3>
          ${infoRows(user)}
        </div>
        <form class="panel span-7" id="profileRequestForm">
          <h3>Request Information Update</h3>
          <div class="grid" style="gap:12px;">
            <div class="span-6">${field("phone", "Phone Number", user.phone)}</div>
            <div class="span-6">${field("studentId", "Student Registration ID", user.studentId)}</div>
            <div class="span-6">${field("department", "Academic Department", user.department)}</div>
            <div class="span-6">${field("year", "Academic Year", user.year)}</div>
            <div class="span-12">${field("skills", "Technical Capabilities", user.skills)}</div>
            <div class="span-6">${field("Contact", "Emergency Contact Number", user.Contact)}</div>
            <div class="span-6">${field("linkedin", "LinkedIn URL", user.linkedin)}</div>
          </div>
          <button class="btn" type="submit">Submit Request</button>
        </form>
        <div class="panel span-5">
          <h3>Recent Requests</h3>
          ${myRequests.length ? myRequests.slice().reverse().map(profileRequestMini).join("") : `<p class="label">No update requests filed.</p>`}
        </div>
      </section>
    `;
  }

  function infoRows(user) {
    return `
      <p><strong>Email Address:</strong> ${escapeHtml(user.email)}</p>
      <p><strong>Phone Number:</strong> ${escapeHtml(user.phone)}</p>
      <p><strong>Cell Portfolio:</strong> ${escapeHtml(user.portfolio)}</p>
      <p><strong>Hierarchical Role:</strong> ${roles[user.role]}</p>
      <p><strong>Assigned Designation:</strong> ${escapeHtml(user.position)}</p>
      <p><strong>Student ID:</strong> ${escapeHtml(user.studentId)}</p>
      <p><strong>Department:</strong> ${escapeHtml(user.department)}</p>
      <p><strong>Current Year:</strong> ${escapeHtml(user.year)}</p>
      <p><strong>Core Strengths:</strong> ${escapeHtml(user.skills)}</p>
      <p><strong>Induction Date:</strong> ${escapeHtml(user.joinedOn || "Unspecified")}</p>
      <p><strong>LinkedIn:</strong> ${user.linkedin ? `<a href="${escapeHtml(user.linkedin)}" target="_blank" rel="noreferrer">${escapeHtml(user.linkedin)}</a>` : "Not set"}</p>
      <p><strong>Account Status:</strong> ${escapeHtml(user.status)}</p>
    `;
  }

  function teamsView() {
    return `
      <section class="grid">
        <div class="panel span-12">
          <div class="row between">
            <h3>Portfolio Rosters</h3>
            <span class="pill">${state.users.filter((user) => user.status === "Active").length} Active Officers</span>
          </div>
          <div class="team-grid">${portfolios.map(teamCard).join("")}</div>
        </div>
      </section>
    `;
  }

  function teamSummaryCard(portfolio) {
    const members = state.users.filter((user) => user.portfolio === portfolio && user.status === "Active");
    const leads = members.filter((user) => ["head", "joint_head"].includes(user.role)).length;
    return `
      <div class="team-card">
        <span class="label">${portfolio}</span>
        <strong>${members.length} Officers</strong>
        <p>${leads} Administrative Leads</p>
      </div>
    `;
  }

  function teamCard(portfolio) {
    const members = state.users.filter((user) => user.portfolio === portfolio && user.status === "Active");
    return `
      <div class="team-card">
        <div class="row between">
          <h4>${portfolio} Unit</h4>
          <span class="pill">${members.length}</span>
        </div>
        ${members.length ? members.map(memberCard).join("") : `<p class="label">No personnel assigned.</p>`}
      </div>
    `;
  }

  function memberCard(user) {
    return `
      <div class="member-card">
        <strong>${escapeHtml(user.name)}</strong>
        <span class="pill">${roles[user.role]}</span>
        <p>${escapeHtml(user.position)} · ${escapeHtml(user.department)} · ${escapeHtml(user.year)}</p>
        <p class="label">${escapeHtml(user.skills || "Core fields unlisted")}</p>
      </div>
    `;
  }

  function membersView(user) {
    const editable = isSuper(user);
    const pendingProfileRequests = state.profileRequests.filter((request) => request.status === "Pending");
    return `
      <section class="grid">
        <div class="panel ${editable ? "span-7" : "span-12"}">
          <div class="row between">
            <h3>Cell Roster</h3>
            <select id="portfolioFilter" style="max-width:220px;">
              <option value="All">All Divisions</option>
              ${portfolios.map((portfolio) => `<option>${portfolio}</option>`).join("")}
            </select>
          </div>
          <div class="table-wrap">${membersTable()}</div>
        </div>
        ${editable ? memberForm() : `<div class="panel span-12 notice">Data management interface restricted to Super Admin protocols.</div>`}
        ${editable ? `
          <div class="panel span-12">
            <h3>Profile Change Requests</h3>
            ${pendingProfileRequests.length ? pendingProfileRequests.map(profileRequestCard).join("") : `<p class="label">No modifications pending review.</p>`}
          </div>
        ` : ""}
      </section>
    `;
  }

  function membersTable(filter = "All") {
    const rows = state.users
      .filter((user) => filter === "All" || user.portfolio === filter)
      .map((user) => `
        <tr>
          <td><strong>${escapeHtml(user.name)}</strong><br><span class="label">${escapeHtml(user.email)}</span></td>
          <td>${escapeHtml(user.phone)}</td>
          <td>${escapeHtml(user.portfolio)}</td>
          <td><span class="pill">${roles[user.role]}</span></td>
          <td>${escapeHtml(user.position)}<br><span class="label">${escapeHtml(user.department)} · ${escapeHtml(user.year)}</span></td>
          <td>${escapeHtml(user.status)}</td>
          <td>${isSuper() ? `<button class="btn secondary" data-edit-member="${user.id}" type="button">Modify</button>` : ""}</td>
        </tr>
      `).join("");
    return `
      <table>
        <thead><tr><th>Identity</th><th>Contact</th><th>Portfolio</th><th>Role Classification</th><th>Designation Details</th><th>Status</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function memberForm(member = null) {
    const item = member || {};
    return `
      <form class="panel span-5" id="memberForm">
        <h3>${member ? "Modify Record" : "Enlist New Member"}</h3>
        <input type="hidden" name="id" value="${escapeHtml(item.id || "")}">
        ${field("name", "Full Name", item.name || "", true)}
        ${field("email", "Authorized Email", item.email || "", true, "email")}
        ${field("phone", "Primary Phone", item.phone || "", true)}
        ${field("studentId", "Student ID Token", item.studentId || "")}
        ${field("department", "Department Field", item.department || "")}
        ${field("year", "Batch Year", item.year || "")}
        <label class="field"><span>Portfolio Core</span><select name="portfolio">${portfolios.map((portfolio) => `<option ${item.portfolio === portfolio ? "selected" : ""}>${portfolio}</option>`).join("")}</select></label>
        <label class="field"><span>Role Class</span><select name="role">${Object.entries(roles).map(([value, label]) => `<option value="${value}" ${item.role === value ? "selected" : ""}>${label}</option>`).join("")}</select></label>
        ${field("position", "Assigned Position", item.position || "Member", true)}
        ${field("skills", "Core Talents", item.skills || "")}
        ${field("joinedOn", "Enlistment Date", item.joinedOn || new Date().toISOString().slice(0, 10), false, "date")}
        ${field("linkedin", "LinkedIn URL", item.linkedin || "")}
        <label class="field"><span>Portal Access Key</span><input name="password" type="text" value="${escapeHtml(item.password || "")}" placeholder="Leave blank to auto-generate password"></label>
        <label class="field"><span>Operational State</span><select name="status"><option ${item.status === "Active" ? "selected" : ""}>Active</option><option ${item.status === "Inactive" ? "selected" : ""}>Inactive</option></select></label>
        <button class="btn" type="submit">${member ? "Save Record Modifications" : "Commit New Enlistment"}</button>
      </form>
    `;
  }

  function profileRequestMini(request) {
    const cls = request.status === "Approved" ? "ok" : request.status === "Rejected" ? "bad" : "wait";
    return `
      <div style="border-bottom:1px solid var(--line);padding:12px 0;">
        <div class="row between">
          <strong>${formatDate(request.requestedDate)}</strong>
          <span class="pill ${cls}">${escapeHtml(request.status)}</span>
        </div>
        <p class="label">${escapeHtml(request.summary)}</p>
      </div>
    `;
  }

  function profileRequestCard(request) {
    const user = state.users.find((item) => item.id === request.userId);
    return `
      <div style="border-bottom:1px solid var(--line);padding:12px 0;">
        <div class="row between">
          <strong>${escapeHtml(user?.name || "Unknown Identity")}</strong>
          <span class="pill wait">Pending Check</span>
        </div>
        <div class="table-wrap">${profileDiffTable(user, request.updates)}</div>
        <div class="row">
          <button class="btn" data-approve-profile="${request.id}" type="button">Approve Update</button>
          <button class="btn warn" data-reject-profile="${request.id}" type="button">Reject</button>
        </div>
      </div>
    `;
  }

  function profileDiffTable(user, updates) {
    const rows = profileFields.map((key) => `
      <tr>
        <td>${labelFor(key)}</td>
        <td>${escapeHtml(user?.[key] || "")}</td>
        <td>${escapeHtml(updates?.[key] || "")}</td>
      </tr>
    `).join("");
    return `<table><thead><tr><th>Parameters</th><th>Current Values</th><th>Requested Modifications</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function labelFor(key) {
    return key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
  }

  function meetingsView() {
    return `
      <section class="grid">
        <form class="panel span-5" id="meetingForm">
          <h3>Schedule Operational Assembly</h3>
          ${field("title", "Assembly Objective", "", true)}
          <label class="field"><span>Portfolio Focus</span><select name="portfolio"><option>All</option>${portfolios.map((portfolio) => `<option>${portfolio}</option>`).join("")}</select></label>
          ${field("date", "Target Date", new Date().toISOString().slice(0, 10), true, "date")}
          ${field("time", "Target Time", "16:00", true, "time")}
          ${field("venue", "Assigned Venue", "", true)}
          <label class="field"><span>Brief / Minutes Outline</span><textarea name="notes"></textarea></label>
          <button class="btn" type="submit">Deploy & Push Alerts</button>
        </form>
        <div class="panel span-7">
          <h3>Log of Assemblies</h3>
          ${meetingList(state.meetings.slice().reverse(), true)}
        </div>
      </section>
    `;
  }

  function meetingList(meetings, withActions = false) {
    if (!meetings.length) return `<p class="label">No scheduled assemblies found.</p>`;
    return meetings.map((meeting) => `
      <div style="border-bottom:1px solid var(--line);padding:12px 0;">
        <div class="row between">
          <strong>${escapeHtml(meeting.title)}</strong>
          <span class="pill ${meeting.notified ? "ok" : "wait"}">${meeting.notified ? "Dispatched" : "Staged"}</span>
        </div>
        <p class="label">${formatDate(meeting.date)} · ${escapeHtml(meeting.time)} · ${escapeHtml(meeting.venue)} · ${escapeHtml(meeting.portfolio)} Division</p>
        ${meeting.notes ? `<p>${escapeHtml(meeting.notes)}</p>` : ""}
        ${withActions ? `<button class="btn secondary" data-notify="${meeting.id}" type="button">Dispatch Alert Notification</button>` : ""}
      </div>
    `).join("");
  }

  function attendanceView() {
    const pending = state.attendanceRequests.filter((request) => request.status === "Pending");
    return `
      <section class="grid">
        <div class="panel span-5">
          <h3>Token Scanned Verification</h3>
          <label class="field"><span>Target Session</span><select id="scanMeeting">${state.meetings.map((meeting) => `<option value="${meeting.id}">${escapeHtml(meeting.title)} · ${formatDate(meeting.date)}</option>`).join("")}</select></label>
          <video class="scanner hide" id="scannerVideo" playsinline></video>
          <div class="row">
            <button class="btn" id="startScan" type="button">Initialize Camera</button>
            <button class="btn secondary" id="stopScan" type="button">Terminate</button>
          </div>
          <p class="label">If hardware module is unavailable, type token alphanumeric data below.</p>
          <form id="manualScanForm" class="row">
            <input name="code" placeholder="IIEC-XXXXX-XXXX" required>
            <button class="btn secondary" type="submit">Verify Token</button>
          </form>
        </div>
        <div class="panel span-7">
          <h3>Live Verification Metrics</h3>
          <div class="table-wrap">${attendanceTable()}</div>
        </div>
        <form class="panel span-5" id="attendanceRequestForm">
          <h3>Log Manual Modification Request</h3>
          <label class="field"><span>Target Personnel</span><select name="userId">${state.users.map((user) => `<option value="${user.id}">${escapeHtml(user.name)} · ${escapeHtml(user.portfolio)}</option>`).join("")}</select></label>
          <label class="field"><span>Target Session</span><select name="meetingId">${state.meetings.map((meeting) => `<option value="${meeting.id}">${escapeHtml(meeting.title)} · ${formatDate(meeting.date)}</option>`).join("")}</select></label>
          <label class="field"><span>Ascribed Metric</span><select name="newStatus"><option>Present</option><option>Absent</option><option>On Leave</option></select></label>
          <label class="field"><span>Adjustment Justification</span><textarea name="reason" required></textarea></label>
          <button class="btn" type="submit">Submit to Super Admin</button>
        </form>
        <div class="panel span-12">
          <h3>Pending Log Amendments</h3>
          ${pending.length ? pending.map(changeRequestCard).join("") : `<p class="label">No adjustment parameters require review.</p>`}
        </div>
      </section>
    `;
  }

  function attendanceTable() {
    const rows = state.attendance.slice().reverse().map((record) => {
      const user = state.users.find((item) => item.id === record.userId);
      const meeting = state.meetings.find((item) => item.id === record.meetingId);
      return `
        <tr>
          <td>${escapeHtml(user?.name || "Unknown")}</td>
          <td>${escapeHtml(meeting?.title || "Unknown")}</td>
          <td>${formatDate(record.date)}</td>
          <td><span class="pill ok">${escapeHtml(record.status)}</span></td>
          <td>${escapeHtml(record.markedByName)}</td>
        </tr>
      `;
    }).join("");
    return `<table><thead><tr><th>Personnel</th><th>Session Context</th><th>Date Verified</th><th>Metric</th><th>Authorized Officer</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  function changeRequestCard(request) {
    const user = state.users.find((item) => item.id === request.userId);
    const meeting = state.meetings.find((item) => item.id === request.meetingId);
    return `
      <div style="border-bottom:1px solid var(--line);padding:12px 0;">
        <div class="row between">
          <strong>${escapeHtml(user?.name || "Unknown")} · ${escapeHtml(meeting?.title || "Unknown")}</strong>
          <span class="pill wait">Awaiting Evaluation</span>
        </div>
        <p>${escapeHtml(request.reason)}</p>
        <div class="row">
          <button class="btn" data-approve-attendance="${request.id}" type="button">Verify & Amend</button>
          <button class="btn warn" data-reject-attendance="${request.id}" type="button">Dismiss</button>
        </div>
      </div>
    `;
  }

  function leaveView(user) {
    const visibleLeaves = canAdmin(user) ? state.leaves : state.leaves.filter((leave) => leave.userId === user.id);
    return `
      <section class="grid">
        <form class="panel span-5" id="leaveForm">
          <h3>File Absence Documentation</h3>
          ${field("from", "Effective From", new Date().toISOString().slice(0, 10), true, "date")}
          ${field("to", "Effective To", new Date().toISOString().slice(0, 10), true, "date")}
          <label class="field"><span>Justification Statement</span><textarea name="reason" required></textarea></label>
          <button class="btn" type="submit">Submit Documentation</button>
        </form>
        <div class="panel span-7">
          <h3>${canAdmin(user) ? "Absence Audits Queue" : "My Filed Documentation"}</h3>
          ${visibleLeaves.length ? visibleLeaves.slice().reverse().map(leaveCard).join("") : `<p class="label">No logs documented.</p>`}
        </div>
      </section>
    `;
  }

  function leaveCard(leave) {
    const user = state.users.find((item) => item.id === leave.userId);
    const cls = leave.status === "Approved" ? "ok" : leave.status === "Rejected" ? "bad" : "wait";
    return `
      <div style="border-bottom:1px solid var(--line);padding:12px 0;">
        <div class="row between">
          <strong>${escapeHtml(user?.name || "Unknown Identity")}</strong>
          <span class="pill ${cls}">${escapeHtml(leave.status)}</span>
        </div>
        <p class="label">Duration Range: ${formatDate(leave.from)} to ${formatDate(leave.to)}</p>
        <p>${escapeHtml(leave.reason)}</p>
        ${canAdmin() && leave.status === "Pending" ? `
          <div class="row">
            <button class="btn" data-approve-leave="${leave.id}" type="button">Approve Log</button>
            <button class="btn warn" data-reject-leave="${leave.id}" type="button">Reject Log</button>
          </div>` : ""}
      </div>
    `;
  }

  function settingsView() {
    return `
      <section class="grid">
        <form class="panel span-7" id="settingsForm">
          <h3>Cloud Matrix Synchronization</h3>
          <p class="notice">Deploy your compiled processing system as an operational web application, provide its transmission endpoint, and database pipeline pipelines will bind immediately.</p>
          <label class="field"><span>Cloud Application Endpoint URL</span><input name="sheetUrl" value="${escapeHtml(state.sheetUrl)}" placeholder="https://script.google.com/macros/s/.../exec"></label>
          <label class="field"><span>Shared Authorization Secret</span><input name="sheetSecret" value="${escapeHtml(state.sheetSecret)}" placeholder="Enter security passphrase matrix token"></label>
          <button class="btn" type="submit">Verify & Mount Connection</button>
        </form>
        <div class="panel span-5">
          <h3>Access Permission Protocol</h3>
          <p><strong>Super Admin:</strong> Full record modification capability, script integration setups, system overrides.</p>
          <p><strong>Admin:</strong> Assembly planning management, token verification modules, leave evaluation pipelines.</p>
          <p><strong>Members:</strong> Token visibility, personal file audits, absence documentation submission.</p>
        </div>
      </section>
    `;
  }

  function field(name, label, value = "", required = false, type = "text") {
    return `<label class="field"><span>${label}</span><input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""}></label>`;
  }

  function textareaField(name, label, value = "", required = false) {
    return `<label class="field"><span>${label}</span><textarea name="${name}" ${required ? "required" : ""}>${escapeHtml(value)}</textarea></label>`;
  }

  function bindLogin() {
    document.getElementById("loginForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const user = state.users.find((item) =>
        item.email.toLowerCase() === data.email.toLowerCase() &&
        item.password === data.password &&
        item.status === "Active"
      );
      if (!user) {
        document.getElementById("loginError").classList.remove("hide");
        return;
      }
      state.activeUserId = user.id;
      save();
      render();
    });
  }

  function bindShell() {
    document.querySelectorAll("[data-view]").forEach((button) => {
      button.addEventListener("click", () => {
        view = button.dataset.view;
        render();
      });
    });
    document.getElementById("logoutBtn").addEventListener("click", () => {
      state.activeUserId = null;
      save();
      render();
    });
    document.getElementById("installBtn")?.addEventListener("click", installPwa);
  }

  function bindRoute() {
    if (view === "myqr") bindProfile();
    if (view === "members") bindMembers();
    if (view === "meetings") bindMeetings();
    if (view === "attendance") bindAttendance();
    if (view === "leave") bindLeave();
    if (view === "settings") bindSettings();
  }

  function bindProfile() {
    document.getElementById("profileRequestForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const user = currentUser();
      const updates = {};
      profileFields.forEach((key) => {
        updates[key] = String(data[key] || "").trim();
      });
      const changed = profileFields.filter((key) => updates[key] !== String(user[key] || ""));
      if (!changed.length) {
        alert("No configuration profile alterations recorded.");
        return;
      }
      const request = {
        id: uid("pr"),
        userId: user.id,
        requestedBy: user.id,
        requestedByName: user.name,
        requestedDate: new Date().toISOString().slice(0, 10),
        requestedAt: new Date().toISOString(),
        updates,
        summary: changed.map(labelFor).join(", "),
        status: "Pending",
        decidedBy: "",
        decidedAt: ""
      };
      state.profileRequests.push(request);
      save();
      syncSheet("profile_request_create", request);
      render();
    });
  }

  function bindMembers() {
    document.getElementById("portfolioFilter")?.addEventListener("change", (event) => {
      event.currentTarget.closest(".panel").querySelector(".table-wrap").innerHTML = membersTable(event.target.value);
      bindMembers();
    });
    document.querySelectorAll("[data-edit-member]").forEach((button) => {
      button.addEventListener("click", () => {
        const member = state.users.find((user) => user.id === button.dataset.editMember);
        document.getElementById("memberForm").outerHTML = memberForm(member);
        bindMembers();
      });
    });
    document.querySelectorAll("[data-approve-profile]").forEach((button) => {
      button.addEventListener("click", () => resolveProfileRequest(button.dataset.approveProfile, true));
    });
    document.querySelectorAll("[data-reject-profile]").forEach((button) => {
      button.addEventListener("click", () => resolveProfileRequest(button.dataset.rejectProfile, false));
    });
    document.getElementById("memberForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      
      // Automatic Password Generation logic if left empty
      if (!data.password || data.password.trim() === "") {
        data.password = generateRandomPassword();
      }

      if (data.id) {
        const index = state.users.findIndex((user) => user.id === data.id);
        state.users[index] = { ...state.users[index], ...data };
        syncSheet("member_update", state.users[index]);
      } else {
        const portfolioShort = String(data.portfolio || "GEN").substring(0, 3).toUpperCase();
        const member = {
          ...memberDefaults,
          ...data,
          id: uid("u"),
          // Automatic clean unique QR string token generation
          qrCode: `IIEC-${portfolioShort}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
        };
        state.users.push(member);
        syncSheet("member_create", member);
        
        // Alerts you to the password generated so you can log it or share it
        alert(`Account Added Successfully!\n\nName: ${member.name}\nPassword: ${member.password}\nToken: ${member.qrCode}`);
      }
      save();
      render();
    });
  }

  function bindMeetings() {
    document.getElementById("meetingForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const meeting = { ...Object.fromEntries(new FormData(event.currentTarget)), id: uid("m"), notified: false };
      state.meetings.push(meeting);
      save();
      syncSheet("meeting_create", meeting);
      notifyMeeting(meeting.id);
      render();
    });
    document.querySelectorAll("[data-notify]").forEach((button) => {
      button.addEventListener("click", () => notifyMeeting(button.dataset.notify));
    });
  }

  function bindAttendance() {
    document.getElementById("startScan")?.addEventListener("click", startScanner);
    document.getElementById("stopScan")?.addEventListener("click", stopScanner);
    document.getElementById("manualScanForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = new FormData(event.currentTarget).get("code");
      markAttendance(code);
      event.currentTarget.reset();
    });
    document.getElementById("attendanceRequestForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      const meeting = state.meetings.find((item) => item.id === data.meetingId);
      const request = {
        ...data,
        id: uid("ar"),
        date: meeting?.date || new Date().toISOString().slice(0, 10),
        requestedBy: currentUser().id,
        requestedByName: currentUser().name,
        status: "Pending",
        requestedAt: new Date().toISOString()
      };
      state.attendanceRequests.push(request);
      save();
      syncSheet("attendance_request_create", request);
      render();
    });
    document.querySelectorAll("[data-approve-attendance]").forEach((button) => {
      button.addEventListener("click", () => resolveAttendanceRequest(button.dataset.approveAttendance, true));
    });
    document.querySelectorAll("[data-reject-attendance]").forEach((button) => {
      button.addEventListener("click", () => resolveAttendanceRequest(button.dataset.rejectAttendance, false));
    });
  }

  function bindLeave() {
    document.getElementById("leaveForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      const leave = {
        ...Object.fromEntries(new FormData(event.currentTarget)),
        id: uid("l"),
        userId: currentUser().id,
        status: "Pending",
        decidedBy: ""
      };
      state.leaves.push(leave);
      save();
      syncSheet("leave_create", leave);
      render();
    });
    document.querySelectorAll("[data-approve-leave]").forEach((button) => {
      button.addEventListener("click", () => resolveLeave(button.dataset.approveLeave, "Approved"));
    });
    document.querySelectorAll("[data-reject-leave]").forEach((button) => {
      button.addEventListener("click", () => resolveLeave(button.dataset.rejectLeave, "Rejected"));
    });
  }

  function bindSettings() {
    document.getElementById("settingsForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      state.sheetUrl = new FormData(event.currentTarget).get("sheetUrl").trim();
      state.sheetSecret = new FormData(event.currentTarget).get("sheetSecret").trim();
      save();
      render();
    });
  }

  function notifyMeeting(meetingId) {
    const meeting = state.meetings.find((item) => item.id === meetingId);
    if (!meeting) return;
    const recipients = state.users.filter((user) =>
      user.status === "Active" && (meeting.portfolio === "All" || user.portfolio === meeting.portfolio)
    );
    if ("Notification" in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          recipients.forEach((user) => {
            new Notification(`IIEC Panel Notice: ${meeting.title}`, {
              body: `${formatDate(meeting.date)} at ${meeting.time}. Token: ${user.qrCode}`,
              icon: "icons/icon.svg"
            });
          });
        }
      });
    }
    meeting.notified = true;
    save();
    syncSheet("meeting_notify", { meeting, recipients: recipients.map((user) => user.id) });
    render();
  }

  async function startScanner() {
    if (!("BarcodeDetector" in window)) {
      alert("Hardware module parsing execution unsupported on this browser client. Please use manual alphanumeric data token fallback entry.");
      return;
    }
    const video = document.getElementById("scannerVideo");
    video.classList.remove("hide");
    videoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    video.srcObject = videoStream;
    await video.play();
    const detector = new BarcodeDetector({ formats: ["qr_code"] });
    const scan = async () => {
      if (!videoStream) return;
      const codes = await detector.detect(video).catch(() => []);
      if (codes.length) {
        markAttendance(codes[0].rawValue);
        stopScanner();
        return;
      }
      requestAnimationFrame(scan);
    };
    scan();
  }

  function stopScanner() {
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop());
      videoStream = null;
    }
  }

  function markAttendance(code) {
    const user = state.users.find((item) => item.qrCode === String(code).trim());
    const meetingId = document.getElementById("scanMeeting")?.value || state.meetings.at(-1)?.id;
    const meeting = state.meetings.find((item) => item.id === meetingId);
    if (!user || !meeting) {
      alert("Token verification signature or target agenda reference could not be resolved.");
      return;
    }
    const existing = state.attendance.find((item) => item.userId === user.id && item.meetingId === meeting.id);
    if (existing) {
      alert("Verification matrix already committed for this personnel block and target agenda reference.");
      return;
    }
    const record = {
      id: uid("a"),
      userId: user.id,
      meetingId: meeting.id,
      date: meeting.date,
      status: "Present",
      markedBy: currentUser().id,
      markedByName: currentUser().name,
      markedAt: new Date().toISOString()
    };
    state.attendance.push(record);
    save();
    syncSheet("attendance_create", record);
    render();
  }

  function resolveAttendanceRequest(id, approved) {
    if (!isSuper()) {
      alert("Operation restricted. Action requires elevation to Super Admin protocols.");
      return;
    }
    const request = state.attendanceRequests.find((item) => item.id === id);
    if (!request) return;
    request.status = approved ? "Approved" : "Rejected";
    request.decidedBy = currentUser().id;
    request.decidedAt = new Date().toISOString();
    if (approved) {
      state.attendance.push({
        id: uid("a"),
        userId: request.userId,
        meetingId: request.meetingId,
        date: request.date,
        status: request.newStatus,
        markedBy: currentUser().id,
        markedByName: currentUser().name,
        markedAt: new Date().toISOString()
      });
    }
    save();
    syncSheet("attendance_request_resolve", request);
    render();
  }

  function resolveProfileRequest(id, approved) {
    if (!isSuper()) {
      alert("Operation restricted. Action requires elevation to Super Admin protocols.");
      return;
    }
    const request = state.profileRequests.find((item) => item.id === id);
    if (!request) return;
    const user = state.users.find((item) => item.id === request.userId);
    request.status = approved ? "Approved" : "Rejected";
    request.decidedBy = currentUser().id;
    request.decidedAt = new Date().toISOString();
    if (approved && user) {
      profileFields.forEach((key) => {
        user[key] = request.updates[key] || "";
      });
      user.updatedAt = request.decidedAt;
      syncSheet("member_profile_update", user);
    }
    save();
    syncSheet("profile_request_resolve", request);
    render();
  }

  function resolveLeave(id, status) {
    const leave = state.leaves.find((item) => item.id === id);
    if (!leave) return;
    leave.status = status;
    leave.decidedBy = currentUser().id;
    leave.decidedAt = new Date().toISOString();
    save();
    syncSheet("leave_resolve", leave);
    render();
  }

  let installPrompt = null;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
  });

  function installPwa() {
    if (!installPrompt) {
      alert("To add this terminal workspace to your device interface, open your native browser control options menu and choose 'Add to Home screen'.");
      return;
    }
    installPrompt.prompt();
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  render();
})();
