# Deploying PointOfSale API with Docker Compose

This guide explains how to run the project using Docker Compose on an Ubuntu VPS.

Prerequisites on the VPS
- Ubuntu server with root or sudo
- Docker and docker-compose installed

Install Docker & Docker Compose (quick):

```bash
# Install Docker Engine
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io

# Install docker-compose plugin (if not present)
sudo apt-get install -y docker-compose-plugin
# or install docker-compose V1 if you prefer
```

Steps to deploy

1. Copy project files to VPS (e.g. via git clone or rsync).
2. Create a `.env` file (copy from `.env.example`) and set real values, especially `DATABASE_URL` and `JWT_SECRET`.

Example `.env` (use secure passwords):

```
DATABASE_URL="mysql://pos_user:pos_password@db:3306/pos_db"
MYSQL_ROOT_PASSWORD=strong_root_pass
MYSQL_DATABASE=pos_db
MYSQL_USER=pos_user
MYSQL_PASSWORD=pos_password
PORT=3000
JWT_SECRET=super_secret_jwt
```

3. Build and start services:

```bash
cd /path/to/PointOfSale/Api
docker compose up -d --build
```

4. Verify containers are running:

```bash
docker ps
docker compose logs -f app
```

Notes on Prisma migrations
- The container entrypoint runs `npx prisma migrate deploy` if `DATABASE_URL` is set. Ensure you have migration files in the `prisma/` folder (generated via `npx prisma migrate dev` during development).
- If you prefer manual migration, you can exec into the container and run:

```bash
docker compose exec app npx prisma migrate deploy
```

Stopping & Updating
- To update code: push changes to server or pull, then rebuild:

```bash
docker compose pull
docker compose up -d --build
```

Security recommendations
- Do not expose MySQL port publicly unless necessary; use a private network or firewall.
- Use secure, random values for `JWT_SECRET` and DB passwords.
- Consider using a managed DB or external volume backups.

If you want, saya bisa:
- Menambahkan healthcheck di Compose untuk `app` service
- Menambahkan automatic backups untuk MySQL volume
- Menyediakan systemd unit atau script untuk auto-start on boot jika VPS tidak mendukung Docker Compose plugin
