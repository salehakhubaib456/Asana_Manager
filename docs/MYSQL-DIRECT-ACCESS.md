# Direct MySQL access kaise milega

"Direct MySQL access" ka matlab: aap MySQL server se connect ho kar **queries** chala saken (jaise `SET GLOBAL max_connections = 1024;`) ya **config file** edit kar saken.

**Agar XAMPP use nahi kar rahe** – MySQL kahan chal raha hai check karo: direct install (Windows Service), Docker, ya cloud (Aiven etc.). Neeche sab cases cover hain.

---

## 1. Local MySQL (direct install / Windows Service)

Agar MySQL aapki **same machine** par chal raha hai (direct install, Windows Service, ya koi aur local setup – **XAMPP nahi**):

### Option A: Command line (mysql client)

**Pehle check karo:** MySQL **command-line client** install hai?  
- Windows: Start menu mein "MySQL" dhoondo – "MySQL 8.0 Command Line Client" ya similar.  
- Ya `mysql` PATH par ho (jahan MySQL install hai, wahan `bin` folder).

**Windows (MySQL Server direct install):**
```bash
# Agar mysql PATH par hai:
mysql -u root -p -h 127.0.0.1

# Ya MySQL ke bin folder se (path apne install ke hisaab se):
# cd "C:\Program Files\MySQL\MySQL Server 8.0\bin"
# mysql -u root -p
```
- Password: jo aapne MySQL install time par set kiya tha.
- Phir: `SET GLOBAL max_connections = 1024;` aur `SHOW VARIABLES LIKE 'max_connections';`

**Mac/Linux:**
```bash
mysql -u root -p -h 127.0.0.1
# same queries
```

### Option B: MySQL Workbench (GUI – sabse aasaan)

- Download: https://dev.mysql.com/downloads/workbench/
- Connection banao:
  - **Host:** `127.0.0.1` (ya jo aapke `.env` / `DATABASE_URL` mein hai)
  - **Port:** `3306` (ya jo aapka port hai)
  - **User / Password:** jo aapke app ke `.env` mein hai (e.g. DATABASE_URL se)
- Connect → new SQL tab → `SET GLOBAL max_connections = 1024;` chalao.

**.env se details:** Agar `DATABASE_URL=mysql://user:pass@host:3306/dbname` hai to `user`, `pass`, `host`, `3306` yahi use karo.

### Option C: Docker se MySQL chal raha ho

- Container name/ID dekho: `docker ps`
- Shell chalao: `docker exec -it <container_name> mysql -u root -p`
- Password: jo aapne Docker run time par diya (e.g. `MYSQL_ROOT_PASSWORD`).
- Wahan se same queries.  
- **Permanent limit:** `docker run` mein env ya mount kiya hua config (my.cnf) edit karke `max_connections` set karo, phir container restart.

### Config file (permanent) – sirf local install par

- **Windows (MySQL Server):** `C:\ProgramData\MySQL\MySQL Server 8.0\my.ini` (ya jo version, wahi path).
- **Mac:** `/usr/local/etc/my.cnf` ya `/etc/my.cnf`
- **Linux:** `/etc/mysql/mysql.conf.d/mysqld.cnf` ya `/etc/my.cnf`

`[mysqld]` ke andar: `max_connections = 1024`  
Save → MySQL service **restart** (Windows: Services → MySQL → Restart; Mac/Linux: `sudo service mysql restart`).

---

## 2. Remote / Cloud MySQL (Aiven, AWS RDS, DigitalOcean, etc.)

Agar database **internet par** hai (DATABASE_URL mein host `something.aivencloud.com` ya IP):

### Connection

- **Host / Port / User / Password** – yeh sab aapke **DATABASE_URL** ya provider ke dashboard se milte hain.
- **SSL** – cloud DBs usually SSL maangte hain (e.g. `?ssl-mode=REQUIRED`).

### Queries chalao

- **MySQL Workbench** ya **command line** se same host/port/user/password use karke connect karo (SSL enable karke).
- Phir: `SET GLOBAL max_connections = 1024;` chala sakte ho **sirf tab** jab provider ne aapko **SUPER** ya admin rights diye hon.

### Config file

- Remote/cloud par **aapko config file edit karne ka access nahi hota** – woh provider control karta hai.
- Limit badhani ho to **provider dashboard** (Aiven, AWS, etc.) mein ja kar "max connections" / "Connection limit" wala option dekho; wahan se change hota hai.

---

## Short summary

| Setup                | Direct access kaise                    | SET GLOBAL / config |
|----------------------|----------------------------------------|----------------------|
| **Local (no XAMPP)** | `mysql -u root -p -h 127.0.0.1` ya **MySQL Workbench** (host/port/user/pass .env se) | Dono kar sakte ho |
| **Docker**           | `docker exec -it <container> mysql -u root -p` | Container/config edit + restart |
| **Remote / Cloud**   | Workbench/CLI with **DATABASE_URL** wale host, port, user, pass + SSL | SET GLOBAL agar provider allow kare; limit provider dashboard se |

**XAMPP nahi use kar rahe** to sabse simple: **MySQL Workbench** install karo, `.env` / `DATABASE_URL` se host, port, user, password daal kar connect karo, phir `SET GLOBAL max_connections = 1024;` chalao.
