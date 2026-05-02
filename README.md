# Coach Geoff — Fit4Life Gym AI Coach

## Deploy to Netlify (10 minutes)

### Option A — Drag & Drop (Easiest, no terminal needed)

1. Install Node.js from nodejs.org (free)
2. Open terminal / command prompt in this folder
3. Run: npm install
4. Run: npm run build
5. This creates a "dist" folder
6. Go to netlify.com → Log in → Sites → drag the "dist" folder into the page
7. Done — you get a live URL instantly!

### Option B — GitHub + Netlify (Best for updates)

1. Create a free GitHub account at github.com
2. Create a new repository called "fit4life-coach"
3. Upload all these files to that repo
4. Go to netlify.com → Add new site → Import from GitHub
5. Select your repo → Build command: npm run build → Publish dir: dist
6. Click Deploy — done!
7. Every time you update files on GitHub, Netlify auto-redeploys

## After Deploying

- Open your live URL
- Go to the Setup tab
- Enter your EmailJS Service ID, Template ID, and Public Key
- Add your clients with their emails
- Hit Send — emails will work perfectly from the live site!

## EmailJS Free Limits
- 200 emails/month free
- Upgrade to paid ($15/month) for unlimited
