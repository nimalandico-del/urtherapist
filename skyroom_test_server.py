#!/usr/bin/env python3
import json
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


API_KEY = "apikey-43539930-6-fb2201e9baa12459ce8c50c1c3109827"
SKYROOM_API_URL = f"https://www.skyroom.online/skyroom/api/{API_KEY}"
PORT = 8000


HTML = """<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Skyroom API Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 900px; margin: 32px auto; padding: 0 16px; line-height: 1.7; }
    button, input, select { font: inherit; padding: 8px; margin: 4px 0; }
    button { cursor: pointer; }
    label { display: block; margin-top: 12px; }
    pre { direction: ltr; text-align: left; background: #111; color: #eee; padding: 16px; overflow: auto; border-radius: 8px; }
    .row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  </style>
</head>
<body>
  <h1>Skyroom API Test</h1>
  <p>این صفحه ساده از طریق سرور محلی به Skyroom وصل می‌شود تا مشکل CORS نداشته باشید.</p>

  <div class="row">
    <div>
      <h2>1) تست سرویس‌ها</h2>
      <button onclick="getServices()">getServices</button>
    </div>
    <div>
      <h2>2) ساخت اتاق</h2>
      <label>Service ID <input id="serviceId" placeholder="بعد از getServices پر می‌شود" /></label>
      <label>Room Name <input id="roomName" /></label>
      <label>Room Title <input id="roomTitle" value="جلسه تست Skyroom" /></label>
      <button onclick="createRoom()">createRoom</button>
    </div>
    <div>
      <h2>3) لینک ورود</h2>
      <label>Room ID <input id="roomId" /></label>
      <label>User ID <input id="userId" value="test-user-1" /></label>
      <label>Nickname <input id="nickname" value="کاربر تست" /></label>
      <label>Access
        <select id="access">
          <option value="1">Normal</option>
          <option value="2" selected>Presenter</option>
          <option value="3">Operator</option>
        </select>
      </label>
      <button onclick="createLoginUrl()">createLoginUrl</button>
      <p><a id="loginLink" href="#" target="_blank" rel="noreferrer"></a></p>
    </div>
  </div>

  <h2>Response</h2>
  <pre id="output">Ready.</pre>

  <script>
    const output = document.getElementById('output');
    document.getElementById('roomName').value = `test-room-${Date.now()}`;

    function show(value) {
      output.textContent = JSON.stringify(value, null, 2);
    }

    async function skyroom(action, params = {}) {
      output.textContent = `Calling ${action}...`;
      const response = await fetch('/api/skyroom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, params }),
      });
      const data = await response.json();
      show(data);
      if (!response.ok || data.ok === false) {
        throw new Error(data.error_message || data.error || `HTTP ${response.status}`);
      }
      return data.result;
    }

    async function getServices() {
      try {
        const services = await skyroom('getServices');
        const activeService = services.find(service => service.status === 1) || services[0];
        if (activeService?.id) document.getElementById('serviceId').value = activeService.id;
      } catch (error) {
        alert(error.message);
      }
    }

    async function createRoom() {
      try {
        const roomId = await skyroom('createRoom', {
          service_id: Number(document.getElementById('serviceId').value),
          name: document.getElementById('roomName').value,
          title: document.getElementById('roomTitle').value,
          guest_login: false,
          op_login_first: false,
          max_users: 10,
        });
        document.getElementById('roomId').value = roomId;
      } catch (error) {
        alert(error.message);
      }
    }

    async function createLoginUrl() {
      try {
        const loginUrl = await skyroom('createLoginUrl', {
          room_id: Number(document.getElementById('roomId').value),
          user_id: document.getElementById('userId').value,
          nickname: document.getElementById('nickname').value,
          access: Number(document.getElementById('access').value),
          concurrent: 1,
          language: 'fa',
          ttl: 3600,
        });
        const link = document.getElementById('loginLink');
        link.href = loginUrl;
        link.textContent = 'باز کردن لینک ورود Skyroom';
      } catch (error) {
        alert(error.message);
      }
    }
  </script>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML.encode("utf-8"))
            return

        self.send_error(404)

    def do_POST(self):
        if self.path != "/api/skyroom":
            self.send_error(404)
            return

        try:
            body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
            payload = json.loads(body.decode("utf-8"))
            data = json.dumps(payload).encode("utf-8")
            request = urllib.request.Request(
                SKYROOM_API_URL,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )

            with urllib.request.urlopen(request, timeout=15) as response:
                result = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.end_headers()
                self.wfile.write(result)
        except urllib.error.HTTPError as error:
            result = error.read()
            self.send_response(error.code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(result or json.dumps({"ok": False, "error": str(error)}).encode("utf-8"))
        except Exception as error:
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.end_headers()
            self.wfile.write(json.dumps({"ok": False, "error": str(error)}).encode("utf-8"))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"Skyroom test page: http://localhost:{PORT}")
    server.serve_forever()
