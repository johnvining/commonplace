# First run
- Clone the repository
- Add config files (`devconfig.js`/`prodconfig.js` for server, `.env*` files for site)
- Add any files you'd like to import, so that they can be copied in to the containers
- If prod: `docker-compose build`, `docker-compose up``
- If not prod:
    - Start mongo on local machine: `sudo mongod --dbpath /System/Volumes/Data/data/db`
    - Start the server: `cd server`, `npm run dev`
    - Start the site: `cd site`, `npm run dev`

# Running the CLI from docker
Copy the file in to the folder for server then run:

- `sudo docker exec -it commonplace-server sh && npm run cli`
- `npm run cli`

# Loading a new version on to rasp pi
- `git pull origin HEAD`
- `sudo docker-compose build`
- `sudo docker-compose up`

# Problems
## If `npm install` takes forever or fails with a `CERT_NOT_YET_VALID` error
Check that the system date/time is correct by running `date` in the shell. If it isn't, update with `ntpdate ntp.ubuntu.com`.

## If docker on pi has wrong version of a module
Need to re-install the packages to get the correct version. Bring docker down, prune, build. [Link 1](https://www.reddit.com/r/docker/comments/tm3ojb/docker_not_updating_node_modules_with_new/), [Link 2](https://stackoverflow.com/questions/32612650/how-to-get-docker-compose-to-always-re-create-containers-from-fresh-images)

# Backup
## Mongo Database
Extract the mongo database docker volume into a tarball:
`docker run --rm --volumes-from commonplace-db -v $(pwd):/backup ubuntu tar cvf /backup/backup-mongo.tar /data/db`

Alternatively, you can use `mongodump` and `mongorestore`:
- `mongodump --uri="mongodb://<IP addr>:<port>"`
- `mongorestore --uri="mongodb://<IP addr>:<port>"`

## image-store

Extract the image-store folder to the present directory, assuming the image-store is at `/usr/src/app/image-store`:
`docker run --rm --volumes-from commonplace-server -v $(pwd):/backup ubuntu tar cvf /backup/backup-image-store.tar /usr/src/app/image-store`

# Running the CLI
Once the `commonplace-server` container is up and running, you can enter it and use the command-line interface:
- `docker exec -it commonplace-server sh`
- `npm run cli`

If you want to import `csv`'s, you can put those in `/server` before the build step, which will copy them into `/usr/src/app` for you. That path can be accessed from the cli during `load`.
