# Spaces migration – "Too many connections" ke baad

MySQL jab bhi connections limit par ho, migration chalane ke **2 tareeke** hain:

---

## Option 1: Browser / curl se (app ke pool use hoga)

1. **MySQL restart karo** taake purani connections clear hon:
   - **Windows (XAMPP):** XAMPP Control Panel → MySQL → Stop, phir Start
   - **Windows (Service):** Admin CMD → `net stop mysql` phir `net start mysql`
   - **Mac/Linux:** `sudo service mysql restart` ya `brew services restart mysql`

2. **App start karo** (agar nahi chal rahi):
   ```bash
   npm run dev
   ```

3. Browser mein open karo ya terminal se:
   ```
   http://localhost:3000/api/dev/migrate-spaces
   ```
   Ya:
   ```bash
   curl http://localhost:3000/api/dev/migrate-spaces
   ```
   Success par: `{"ok":true,"log":["✓ spaces table",...]}`

---

## Option 2: Script se (MySQL restart ke turant baad)

1. **Pehle dev server band karo** (Ctrl+C).
2. **MySQL restart karo** (upar wale steps).
3. **Turant yeh chalao** (connections kam honge):
   ```bash
   npm run db:migrate-spaces
   ```

---

Dono tarah se migration **spaces** table aur **folders.space_id** column create karti hai. Ek baar success ho jaye to dubara run karne ki zaroorat nahi.
