# Resend se Invitation Email Inbox tak kaise bhejein

Jab tak aap **apna domain Resend pe verify** nahi karte, invitation email sirf Resend ke "test" email par hi jaati hai. Real inbox (Gmail, Outlook, etc.) ke liye domain verify karna zaroori hai.

---

## Step 1: Resend account

1. https://resend.com pe jao  
2. Sign up / Login karo  
3. **API Keys** se apna key copy karo (re_xxxx...) aur `.env` me daalo:  
   `RESEND_API_KEY="re_xxxx..."`

---

## Step 2: Domain add karo

1. Resend dashboard me **Domains** (left sidebar) pe click karo  
2. **Add Domain** pe click karo  
3. Apna domain likho, jaise:  
   - `yourdomain.com`  
   - ya agar subdomain use karna ho: `mail.yourdomain.com`  
4. **Add** karo  

---

## Step 3: DNS records daalo

Resend tumhe **3 records** dikhayega (SPF, DKIM, etc.). Inhe tumhare domain provider (jaise GoDaddy, Namecheap, Cloudflare, Hostinger) ke **DNS settings** me add karna hai.

### Kahan add karein

- **GoDaddy:** My Products → Domain → DNS → Manage DNS → Add / Edit records  
- **Namecheap:** Domain List → Manage → Advanced DNS → Add New Record  
- **Cloudflare:** Domain select → DNS → Add record  
- **Hostinger:** Domains → Manage → DNS / Nameservers → Add record  

### Kaunse records

Resend me har domain ke liye alag values dikhengi. Example (values tumhare Resend screen pe different honge):

| Type | Name / Host | Value |
|------|-------------|--------|
| **MX** | `send` ya `send.yourdomain.com` | Resend jo bataye (e.g. `feedback-smtp.us-east-1.amazonses.com`) |
| **TXT** | `send` ya `_dmarc` etc. | Resend jo bataye |
| **TXT (DKIM)** | Resend me jo name dikhe (e.g. `resend._domainkey`) | Resend me pura value copy karo |

- **Name/Host:** Resend me "Name" column me jo likha ho (sometimes `send` ya full subdomain).  
- **Value:** Resend me "Value" column me jo likha ho, bilkul waisa paste karo.  
- **TTL:** 3600 ya Auto rakho.

Sab records add karke save karo.

---

## Step 4: Verify karo

1. Resend me wapas **Domains** pe jao  
2. Apne domain ke saamne **Verify** button hoga  
3. Click karo – agar DNS sahi add kiye hon to 1–2 minute me **Verified** ho jayega  
4. Kabhi DNS propagate hone me 24–48 hours bhi lag sakte hain; agar fail aaye to thodi der baad dubara Verify karo  

---

## Step 5: .env me sender email set karo

Domain verify hone ke baad:

1. Project ke root me `.env` file kholo  
2. Ye line add/update karo (apna verified domain use karo):

```env
RESEND_FROM="Asanamanager <noreply@yourdomain.com>"
```

- `yourdomain.com` ki jagah wo domain jo Resend me verify kiya (e.g. `mail.myapp.com`)  
- `noreply@` ki jagah koi bhi address use kar sakte ho jo Resend us domain ke under allow kare (usually `*@yourdomain.com`)

Example:

```env
RESEND_FROM="Asanamanager <noreply@myapp.com>"
```

3. Dev server restart karo:  
   `npm run dev`

---

## Step 6: Invite dobara bhejo

1. App me project kholo  
2. Share → Invite by email  
3. Jis email par bhejna hai wo daalo, Invite click karo  

Ab email us inbox me jaani chahiye. Agar nahi dikhe to **Spam / Junk** folder check karo.

---

## Agar domain nahi hai (sirf testing)

- Resend me **onboarding@resend.dev** se sirf **un emails** par bhej sakte ho jo Resend dashboard me "test" ke liye add kiye hon.  
- Real Gmail/Outlook par bhejne ke liye domain verify karna hi zaroori hai.

---

## Short checklist

- [ ] Resend pe domain add kiya  
- [ ] SPF / DKIM / MX (jo Resend ne diye) DNS me add kiye  
- [ ] Resend me Verify green ho gaya  
- [ ] `.env` me `RESEND_FROM="Asanamanager <noreply@yourdomain.com>"` set kiya  
- [ ] Server restart kiya aur invite dobara bheja  

Iske baad invitation email inbox me aa jani chahiye.
