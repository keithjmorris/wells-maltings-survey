# Wells Maltings Survey

Event feedback survey for Wells Maltings arts charity, with an admin dashboard.

## Stack

- Plain HTML / CSS / JavaScript (no build step needed)
- Firebase Firestore — stores survey responses
- Firebase Authentication — protects the admin dashboard
- Deployed via Vercel (connected to this GitHub repository)

## Setup

### 1. Add your Firebase config

Open `firebase-config.js` and replace the placeholder values with the
`firebaseConfig` object from your Firebase console (Project settings → Your apps).

### 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/wells-maltings-survey.git
git push -u origin main
```

### 3. Deploy on Vercel

1. Go to vercel.com → Add New Project
2. Import your GitHub repository
3. No build settings needed — just click Deploy

### 4. QR codes

Each event's QR code should link to:

```
https://your-vercel-url.vercel.app/?event=Event+Name&date=YYYY-MM-DD
```

The form will pre-fill the event name and date automatically.

### 5. Admin dashboard

Visit `https://your-vercel-url.vercel.app/admin.html` and sign in with
the admin email and password you created in Firebase Authentication.

## File structure

```
wells-maltings-survey/
├── index.html          Survey form (public)
├── admin.html          Admin dashboard (login required)
├── app.js              Form logic + Firestore write
├── admin.js            Auth + Firestore read + CSV export
├── style.css           Shared styles
├── firebase-config.js  Your Firebase keys (do not commit publicly)
└── README.md
```

## Firestore security rules

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /responses/{docId} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

Anyone can submit a response; only authenticated admins can read data.
