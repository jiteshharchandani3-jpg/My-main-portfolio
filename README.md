# ⚡ Alex Mercer — Developer Portfolio

A modern, fully responsive personal portfolio website with a Node.js + Express backend and MongoDB database.

## 📁 Project Structure

```
portfolio/
├── client/
│   └── index.html          # Complete frontend (HTML + CSS + JS)
│
└── server/
    ├── index.js            # Express server + API routes
    ├── package.json        # Backend dependencies
    ├── .env.example        # Environment variable template
    └── .env                # Your actual env vars (never commit!)
```

---

## 🚀 Quick Start

### 1. Frontend (No server needed)

Just open `client/index.html` in your browser. It works standalone — in demo mode, the contact form shows a success message without hitting the backend.

For a local server:
```bash
cd client
npx serve .          # or: python -m http.server 3000
```

---

### 2. Backend Setup

**Prerequisites:**
- Node.js v18+
- MongoDB (local or Atlas)

```bash
# Navigate to server folder
cd server

# Install dependencies
npm install

# Copy env template
cp .env.example .env

# Edit .env with your values
nano .env   # or use any editor
```

**Configure `.env`:**
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/portfolio
FRONTEND_URL=http://localhost:3000
# (optional email fields)
```

**Start the server:**
```bash
# Development (with auto-restart)
npm run dev

# Production
npm start
```

Server will start at `http://localhost:5000`

---

## 🗄️ Database Schema

**Collection:** `contacts`

| Field      | Type    | Required | Description                    |
|-----------|---------|----------|--------------------------------|
| name      | String  | ✅        | Sender's full name (max 80)    |
| email     | String  | ✅        | Validated email address         |
| subject   | String  | ❌        | Message subject (max 150)      |
| message   | String  | ✅        | Message body (10–2000 chars)   |
| ipAddress | String  | —        | Sender's IP (for spam control) |
| read      | Boolean | —        | Read status, default: false    |
| timestamp | Date    | —        | Auto-set on creation           |

**Mongoose model location:** `server/index.js` → `Contact` model

---

## 🔌 API Endpoints

### `GET /api/health`
Returns server and database status.

**Response:**
```json
{
  "status": "ok",
  "uptime": 142.3,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "connected"
}
```

---

### `POST /api/contact`
Submit a contact form message.

**Request body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "subject": "Collaboration Inquiry",
  "message": "Hi! I'd love to work with you on..."
}
```

**Success response (201):**
```json
{
  "success": true,
  "message": "Message received! I'll get back to you soon.",
  "id": "65abc123def456"
}
```

**Error responses:**
- `400` — Validation failed (missing fields, invalid email, short message)
- `429` — Rate limit hit (5 messages/IP/hour)
- `500` — Internal server error

---

## 📧 Email Notifications (Optional)

The backend can send you an email when someone submits the contact form.

**Gmail setup:**
1. Enable 2-Factor Authentication on your Google account
2. Generate an App Password: Google Account → Security → App Passwords
3. Set in `.env`:
   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your@gmail.com
   SMTP_PASS=xxxx-xxxx-xxxx-xxxx   ← App Password
   NOTIFY_EMAIL=your@gmail.com
   ```

**Other providers:** Use SendGrid, Mailgun, or Mailtrap (for dev testing).

---

## 🛡️ Security Features

- **Rate limiting:** Max 5 submissions per IP per hour
- **Input validation:** Server-side via `validator.js`
- **Input sanitization:** XSS prevention via `validator.escape()`
- **Size limits:** JSON body capped at 10KB
- **Spam filtering:** Keyword-based silent reject
- **CORS:** Configurable allowed origins via env vars
- **Security headers:** `X-Content-Type-Options`, `X-Frame-Options`

---

## 🎨 Frontend Features

- **Dark/Light theme toggle** — persists in session
- **Responsive** — mobile, tablet, desktop
- **Smooth scroll reveal** — `IntersectionObserver`-based
- **Project filter** — filter by C++, Python, Web
- **Timeline tabs** — Experience / Education switch
- **Animated skill bars** — trigger on scroll
- **Loading screen** — code-style animation
- **Back to top** — appears after 400px scroll
- **Active nav link** — highlights current section

---

## 🌐 Deployment

### Frontend
Deploy `client/index.html` to any static host:
- [Netlify](https://netlify.com) — drag & drop
- [Vercel](https://vercel.com) — `vercel deploy`
- [GitHub Pages](https://pages.github.com)

### Backend
Deploy to:
- **Railway** — `railway up`
- **Render** — connect GitHub repo
- **Heroku** — `git push heroku main`
- **DigitalOcean App Platform**

Set all environment variables in your platform's dashboard.

### Database
Use [MongoDB Atlas](https://cloud.mongodb.com) for free cloud MongoDB. Get your connection string and set it as `MONGO_URI`.

---

## 🔧 Customization Checklist

- [ ] Replace `Alex Mercer` with your name throughout `index.html`
- [ ] Update hero title, intro paragraph
- [ ] Replace project cards with your real projects
- [ ] Update timeline with your actual experience/education
- [ ] Change contact email and social links
- [ ] Add your real `resume.pdf` in the `client/` folder
- [ ] Update meta tags and OG tags in `<head>`
- [ ] Set your `MONGO_URI` and SMTP credentials in `.env`

---

## 📦 Dependencies

### Backend
| Package | Purpose |
|---------|---------|
| `express` | Web framework |
| `mongoose` | MongoDB ODM |
| `cors` | Cross-origin requests |
| `dotenv` | Environment variables |
| `express-rate-limit` | Rate limiting |
| `nodemailer` | Email notifications |
| `validator` | Input validation & sanitization |
| `nodemon` (dev) | Auto-restart on file change |

---

## 📄 License

MIT © 2025 Alex Mercer
