# CORS Proxy Template

This repository gives an example of how to proxy calls back and forth to Kibo UCP through a Lambda or Express server. It handles the authentication and addition of CORS headers to be able to call from a strorefront or other browser environment.

To use, create a new application with the minimal behaviors needed, then fill out .env with that application's credentials and your tenant configuration (see `example.env` for a reference)

To test locally, run `node src/app.js`. Make sure `CLOUD_ENV` is not `lambda` for this to work.

Then in another terminal tab, run `curl -v 'localhost:8080/siteSearch?query=shoes'`

To add other routes, add lines like this to specify what route you want to map to on the Lambda, and the route to map to in Kibo, e.g. for the example above:

```
corsProxyRoute('/siteSearch', '/api/commerce/catalog/storefront/productsearch/siteSearch')
```

To deploy, set `CLOUD_ENV` to `lambda`, then run `serverless deploy`
