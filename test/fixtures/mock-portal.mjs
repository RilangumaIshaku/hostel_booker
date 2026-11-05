// A local stand-in for the FUTMINNA e-portal. It mirrors the real login field
// names (uid/pwd/login) and a PHP-style table flow, so the browser engine can
// be tested under load, sold-out rooms, and flaky connections without touching
// the real portal or booking anything.
import { createServer } from "node:http";

export const MOCK_LOGIN = "student";
export const MOCK_PASSWORD = "correct-horse";

function layout(title, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head>
<body><div class="portal-shell"><h1>FUTMINNA Student Portal</h1>${body}</div></body></html>`;
}

function loginPage(message = "") {
  return layout("ePortal | Login", `
    ${message ? `<p class="error">${message}</p>` : ""}
    <form role="form" action="/std/index.php" method="post">
      <input type="text" class="form-control" placeholder="Enter User ID/Username" name="uid" maxlength="50" required>
      <input type="password" class="form-control" placeholder="Enter Password" name="pwd" maxlength="50" required>
      <button type="submit" name="login" class="btn-submit">Login</button>
    </form>`);
}

function dashboardPage(name) {
  return layout("ePortal | Dashboard", `
    <h2>Welcome, ${name}</h2>
    <nav>
      <a href="/std/hostel.php">Hostel Accommodation</a>
      <a href="/std/fees.php">School Fees</a>
      <a href="/std/logout.php">Logout</a>
    </nav>
    <p>2026/2027 academic session.</p>`);
}

function row({ hostel, room, available }) {
  return `<tr><td>${hostel}</td><td>${room}</td><td>${available ? "Available" : "Sold out"}</td><td>
    ${available ? `<form method="post" action="/std/book.php">
      <input type="hidden" name="hostel" value="${hostel}">
      <input type="hidden" name="room" value="${room}">
      <button type="submit">Book now</button>
    </form>` : ""}
  </td></tr>`;
}

const HEADER = "<tr><th>Hostel</th><th>Room type</th><th>Status</th><th>Action</th></tr>";

function mixedHostelPage(mode) {
  const rows = mode === "mixedGirlsSoldOut"
    ? [
        row({ hostel: "Bosso Boys Hostel", room: "Room of 4", available: true }),
        row({ hostel: "Bosso Girls Hostel", room: "Room of 4", available: false }),
      ]
    : mode === "mixedBoysBlockSoldOut"
      ? [
          row({ hostel: "Bosso Boys Hostel", room: "Room of 4", available: true }),
          row({ hostel: "Block A & B", room: "Room of 4", available: false }),
        ]
      : [
          row({ hostel: "Bosso Boys Hostel", room: "Room of 4", available: true }),
          row({ hostel: "Bosso Girls Hostel", room: "Room of 4", available: true }),
          row({ hostel: "Medical Hostel", room: "Room of 4", available: true }),
          row({ hostel: "Old Girls Hostel", room: "Room of 4", available: true }),
        ];
  return layout("Hostel Accommodation", `<h2>Hostel Accommodation</h2>
    <table>${HEADER}${rows.join("")}</table>`);
}

function hostelPage(mode) {
  if (mode === "mixed" || mode === "mixedGirlsSoldOut" || mode === "mixedBoysBlockSoldOut") {
    return mixedHostelPage(mode);
  }
  if (mode === "notopen") {
    return layout("Hostel Accommodation", `<h2>Hostel Accommodation</h2>
      <p>Hostel booking has not yet opened for the 2026/2027 session.</p>`);
  }
  if (mode === "soldout") {
    return layout("Hostel Accommodation", `<h2>Hostel Accommodation</h2>
      <table>
        <tr><th>Hostel</th><th>Room type</th><th>Status</th><th>Action</th></tr>
        <tr><td>Needs Assessment Hostel</td><td>Room of 2</td><td>Sold out</td><td></td></tr>
        <tr><td>Needs Assessment Hostel</td><td>Room of 4</td><td>Fully booked</td><td></td></tr>
      </table>
      <p>No rooms are currently available.</p>`);
  }
  if (mode === "room4only") {
    return layout("Hostel Accommodation", `<h2>Hostel Accommodation</h2>
      <table>
        <tr><th>Hostel</th><th>Room type</th><th>Status</th><th>Action</th></tr>
        <tr><td>Needs Assessment Hostel</td><td>Room of 2</td><td>Sold out</td><td></td></tr>
        <tr><td>Needs Assessment Hostel</td><td>Room of 4</td><td>Available</td><td>
          <form method="post" action="/std/book.php">
            <input type="hidden" name="room" value="Room of 4">
            <button type="submit">Book now</button>
          </form>
        </td></tr>
      </table>`);
  }
  return layout("Hostel Accommodation", `<h2>Hostel Accommodation</h2>
    <table>
      <tr><th>Hostel</th><th>Room type</th><th>Status</th><th>Action</th></tr>
      <tr><td>Needs Assessment Hostel</td><td>Room of 2</td><td>Available</td><td>
        <form method="post" action="/std/book.php">
          <input type="hidden" name="room" value="Room of 2">
          <button type="submit">Book now</button>
        </form>
      </td></tr>
      <tr><td>Needs Assessment Hostel</td><td>Room of 4</td><td>Available</td><td>
        <form method="post" action="/std/book.php">
          <input type="hidden" name="room" value="Room of 4">
          <button type="submit">Book now</button>
        </form>
      </td></tr>
    </table>`);
}

function feesPage() {
  return layout("School Fees", `<h2>School Fees</h2>
    <table>
      <tr><th>Item</th><th>Balance</th><th>Action</th></tr>
      <tr>
        <td>School fees 2026/2027</td>
        <td>Outstanding balance: \u20a6 48,500.00</td>
        <td>
          <form method="post" action="/std/pay.php">
            <button type="submit">Pay now</button>
          </form>
        </td>
      </tr>
    </table>`);
}

function gatewayPage() {
  return layout("Secure Payment Gateway", `<h2>Secure payment gateway</h2>
    <p>Transaction reference: RRR-260611-0091</p>
    <p>This is an external cashier page. No card details were requested by this mock.</p>
    <p><a href="/std/dashboard.php">Return to portal</a></p>`);
}

export async function startMockPortal({
  mode = "normal",
  flakyHostelFailures = 0,
  login = MOCK_LOGIN,
  password = MOCK_PASSWORD,
  port = 0,
} = {}) {
  const state = {
    mode,
    flakyHostelFailures,
    login,
    password,
    signedIn: new Set(),
    bookings: [],
    hostelBookings: [],
    payRequests: 0,
    hostelRequests: 0,
    requests: [],
  };

  const readBody = (request) => new Promise((resolve) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => resolve(new URLSearchParams(raw)));
  });

  const server = createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    state.requests.push(`${request.method} ${url.pathname}`);
    const cookie = request.headers.cookie ?? "";
    const sid = /(?:^|;\s*)sid=([^;]+)/.exec(cookie)?.[1];
    const authed = Boolean(sid && state.signedIn.has(sid));

    const send = (status, html, headers = {}) => {
      response.writeHead(status, { "Content-Type": "text/html; charset=utf-8", ...headers });
      response.end(html);
    };
    const redirect = (location, headers = {}) => {
      response.writeHead(302, { Location: location, ...headers });
      response.end();
    };
    const requireAuth = () => {
      if (!authed) {
        redirect("/std/index.php");
        return false;
      }
      return true;
    };

    if (url.pathname === "/std/index.php" && request.method === "GET") {
      if (authed) return send(200, dashboardPage("Ada"));
      return send(200, loginPage());
    }

    if (url.pathname === "/std/index.php" && request.method === "POST") {
      const body = await readBody(request);
      if (body.get("uid") === state.login && body.get("pwd") === state.password) {
        const token = `sid-${state.signedIn.size + 1}`;
        state.signedIn.add(token);
        return redirect("/std/dashboard.php", { "Set-Cookie": `sid=${token}; Path=/; HttpOnly` });
      }
      return send(200, loginPage("Invalid username or password."));
    }

    if (url.pathname === "/std/dashboard.php") {
      if (!requireAuth()) return;
      return send(200, dashboardPage("Ada"));
    }

    if (url.pathname === "/std/hostel.php") {
      state.hostelRequests += 1;
      if (state.flakyHostelFailures > 0) {
        state.flakyHostelFailures -= 1;
        return send(503, layout("Portal busy", "<h2>503 Service Temporarily Unavailable</h2><p>The portal is busy.</p>"));
      }
      if (!requireAuth()) return;
      return send(200, hostelPage(state.mode));
    }

    if (url.pathname === "/std/book.php" && request.method === "POST") {
      if (!requireAuth()) return;
      const body = await readBody(request);
      const room = body.get("room") ?? "unknown";
      const hostel = body.get("hostel") ?? "Needs Assessment Hostel";
      if (state.mode === "failbook") {
        return send(200, layout("Booking failed", "<h2>Booking failed</h2><p>An error occurred. Please try again.</p>"));
      }
      if (state.bookings.length > 0) {
        return send(200, layout("Already booked", `<p>You have already been allocated ${state.bookings[0]}.</p>`));
      }
      state.bookings.push(room);
      state.hostelBookings.push({ hostel, room });
      return send(200, layout("Booking successful", `<h2>Booking successful</h2>
        <p>You have been allocated ${room} in ${hostel}.</p>
        <p>Reference: NAH-2026-0042</p>`));
    }

    if (url.pathname === "/std/fees.php") {
      if (!requireAuth()) return;
      return send(200, feesPage());
    }

    if (url.pathname === "/std/pay.php" && request.method === "POST") {
      if (!requireAuth()) return;
      state.payRequests += 1;
      return send(200, gatewayPage());
    }

    if (url.pathname === "/std/logout.php") {
      if (sid) state.signedIn.delete(sid);
      return redirect("/std/index.php");
    }

    return send(404, layout("404 Not Found", "<h1>Not Found</h1>"));
  });

  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  const actualPort = server.address().port;
  return {
    state,
    origin: `http://127.0.0.1:${actualPort}`,
    url: `http://127.0.0.1:${actualPort}/std/index.php`,
    close: () => new Promise((resolve) => {
      server.closeAllConnections?.();
      server.close(resolve);
    }),
  };
}
