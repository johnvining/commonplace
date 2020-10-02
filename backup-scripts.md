### Backup scripts


Extracts the mongo database to a tarball
`docker run --rm --volumes-from commonplace_mongo_1 -v $(pwd):/backup ubuntu tar cvf /backup/backup-mongo.tar /data/db`

Extracts the image-store folder to the directory it is run from, assumes the image-store is at `/usr/src/app/image-store`

`docker run --rm --volumes-from commonplace-server -v $(pwd):/backup ubuntu tar cvf /backup/backup-image-store.tar /usr/src/app/image-store`


