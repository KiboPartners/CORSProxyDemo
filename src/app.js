require("dotenv").config()
const logger = require('morgan')
const express = require('express')
var proxy = require('express-http-proxy');
let needle = require('needle')

// register the app
const app = express()
app.use(express.json())

// app runs on port 3000 by default. You can change this by providing a PORT environment variable
const port = process.env.PORT || 3000
app.use(logger(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version"', {
  immediate: true
}))

// Will be cached across Lambda invocations
var accessToken;
var expireTime;

let apiContext = {
  appKey: process.env.KIBO_CLIENT_ID,
  sharedSecret: process.env.KIBO_SHARED_SECRET,
  baseUrl: process.env.KIBO_AUTH_HOST,
  apiHost: process.env.KIBO_API_HOST
};

/**
 * Helper function to make sure auth is refreshed.
 * @returns nothing, auth is stored in accessToken.
 */
let refreshAuth = function () {
  return new Promise((resolve, reject) => {
    let now = Math.floor(+new Date() / 1000)
    if (((expireTime == null) || (now > expireTime))) {
      console.log("Getting auth token")
      needle.post(`https://${apiContext.baseUrl}/api/platform/applications/authtickets/oauth`, {
        client_id: apiContext.appKey,
        client_secret: apiContext.sharedSecret,
        grant_type: "client_credentials"
      }, { json: true }, function (err, resp) {
        if (err) {
          reject("Error retrieving auth token");
        } else {
          accessToken = resp.body.access_token
          expireTime = now + resp.body.expires_in
            console.log(accessToken)
          resolve()
        }
      })
    } else {
      resolve()
    }
  })
}

/**
 * 
 * @param {string} routeName The route name for the AWS API Gateway 
 * @param {string} kiboRouteName The Kibo route which this will be mapped to
 */
let corsProxyRoute = function (routeName, kiboRouteName) {
  // Implement the OPTIONS Pre-flight request
  app.options(routeName, async (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Credentials', 'true')
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Authorization');
    res.status(200)
    res.send("")
  })
  app.use(routeName, proxy(`${apiContext.apiHost}`, {
    // Rewrite the path to the Kibo path
    proxyReqPathResolver: function (req) {
      // the path is considered the portion of the url after the host, and including all query params
      // so we need to extract out the query string as we rewrite it and add it back in
      var parts = req.url.split('?');
      var queryString = parts[1];
        console.log(kiboRouteName + (queryString ? '?' + queryString : ''));
      return kiboRouteName + (queryString ? '?' + queryString : '');
    },
    // Decorate request to Kibo with Bearer Auth
    proxyReqOptDecorator: function (proxyReqOpts, srcReq) {
      return new Promise((resolve, reject) => {
        refreshAuth().then(function () {
            console.log(Object.keys(proxyReqOpts));
            console.log(proxyReqOpts);
          proxyReqOpts.headers.Authorization = `Bearer ${accessToken}`
          resolve(proxyReqOpts);
        }).catch(function (error) {
          reject(error)
        })
      })
    },
    // Add CORS headers going back from Response
    userResDecorator: function (proxyRes, proxyResData, userReq, userRes) {
      userRes.set('Access-Control-Allow-Origin', '*');
      userRes.set('Access-Control-Allow-Credentials', 'true')
      userRes.set('Access-Control-Allow-Methods', 'GET');
      userRes.set('Access-Control-Allow-Headers', 'Authorization');
      return proxyResData
    }
  }));
}

// Set up our routes for search clients
corsProxyRoute('/siteSearch', '/api/commerce/catalog/storefront/productsearch/siteSearch')
corsProxyRoute('/suggest2', '/api/commerce/catalog/storefront/productsearch/suggest2')
corsProxyRoute('/visualsearch', '/api/commerce/catalog/storefront/productsearch/visualsearch')

// run the application
if (process.env.CLOUD_ENV === 'lambda') {
  const serverless = require('serverless-http')
  module.exports.handler = serverless(app)
} else {
  app.listen(port, () => console.log(`Listening on port ${port}!`));
}

