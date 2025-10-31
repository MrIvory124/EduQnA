# Running The Lecture Q&A Prototype

## Prerequisites
- Node.js 18 or newer
- npm (ships with Node.js)

## Install Dependencies
~~~bash
npm install
~~~
Run the command once in the project root. It installs Express, Socket.IO, and supporting packages.

## Start The Server
Choose the mode that fits your workflow:

- Production-style run (no auto-restart):
~~~bash
npm start
~~~
- Development run with automatic restart via nodemon:
~~~bash
npm run dev
~~~

By default the server listens on port 3000. Override it with the PORT environment variable (for example, PORT=4000 npm start).

## Interacting With The App
1. Visit http://localhost:3000/ after the server starts. Use the form to create a session, optionally set a friendly name, and pick the duration.
2. After creating a session the page shows:
   - The generated attendee link (includes the session password) for participants
   - The admin dashboard link for moderators
   - The session password and expiry summary in case you need to share details manually
3. The homepage also lists all currently active sessions with their names, IDs, and expiry times. Click any session name to jump straight to the attendee page (password entry still required).
4. Attendees must provide both the session password and a display name before they can participate. Their display name is attached to any question they submit.
5. Share the attendee link plus password with your audience and keep the admin link private.

Each link opens static pages served from public/:
- index.html - create sessions and view the active list
- session.html - attendee view that requires the session password/display name and stays in sync through WebSockets
- admin.html - moderator controls with quick links, mark-as-answered, and remove-question actions

## Optional: API Usage
You can also call the backend directly with HTTP requests. Example session creation with curl:
~~~bash
curl -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"expiresInMinutes":60,"name":"Guest Lecture"}'
~~~
The response includes attendeePath, adminPath, joinPassword, and the resolved session name.

Active sessions can be retrieved with:
~~~bash
curl http://localhost:3000/api/sessions
~~~

## Stopping The Server
Press Ctrl+C in the terminal where the process is running.

## Run In Docker
Build a production image in the project root.
~~~bash
docker build -t lecture-qa:latest .
~~~
Save the image 
~~~bash
docker image save -o myimage.tar lecture-qa
~~~
Run the container and bind the default port 3000 to your host.
~~~bash
docker run --rm -p 3000:3000 --name lecture-qa lecture-qa:latest
~~~
- The left side of `-p host:container` controls the host port. For example `-p 8080:3000` keeps the app listening on 3000 inside the container but publishes it on port 8080 locally.
- To change the port the app listens on inside the container, override the `PORT` environment variable and map the same container port: `docker run --rm -e PORT=4000 -p 4000:4000 lecture-qa:latest`.
- Update both the `ENV PORT=3000` and `EXPOSE 3000` lines in the `Dockerfile` if you want the image itself to advertise a different internal port by default, then rebuild.

Stop the container with Ctrl+C when using `--rm`, or run `docker stop lecture-qa` in another terminal if you launched it without `--rm`.
