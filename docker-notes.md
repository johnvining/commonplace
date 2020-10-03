### backup scripts

#### mongo database
Extract the mongo database docker volume into a tarball:
`docker run --rm --volumes-from commonplace-db -v $(pwd):/backup ubuntu tar cvf /backup/backup-mongo.tar /data/db`

Alternatively, you can use `mongodump` and `mongorestore`:
 * `mongodump --uri="mongodb://<IP addr>:<port>"`
 * `mongorestore --uri="mongodb://<IP addr>:<port>"`

#### image-store

Extract the image-store folder to the present directory, assuming the image-store is at `/usr/src/app/image-store`:
`docker run --rm --volumes-from commonplace-server -v $(pwd):/backup ubuntu tar cvf /backup/backup-image-store.tar /usr/src/app/image-store`

### running the CLI

Once the `commonplace-server` container is up and running, you can enter it and use the command-line interface:
 * `docker exec -it commonplace-server sh`
 * `npm run cli`

If you want to import `csv`'s, you can put those in `/server` before the build step, which will copy them into `/usr/src/app` for you. That path can be accessed from the cli during `load`.
