const functions = require('firebase-functions');
var express = require('express', template = require('pug'));
var session = require('express-session')
var cookieSession = require('firebase-cookie-session')
var util = require('util');
var oauth = require('oauth');

var app = express();

/////////////////////////////////////
// OAuth Config:
// To make authenticated calls to the API, you need OAuth keys 
// To get them, please register your App here:
// https://openlab.openbankproject.com/consumer-registration
var config = process.env.ENV === 'DEV' ? require('./config.json') : require('./prod.json');
//////////////////////////////////////

// Template engine (previously known as Jade)
var pug = require('pug');

// Used to validate forms
var bodyParser = require('body-parser')
app.set('trust proxy', 1)

var _openbankConsumerKey = config.consumerKey;
var _openbankConsumerSecret = config.consumerSecret;
var _openbankRedirectUrl = config.redirectUrl;


// The location, on the interweb, of the OBP API server we want to use.
var apiHost = config.apiHost;

console.log("Your apiHost is: " + apiHost)
console.log("The redirect URL is: " + _openbankRedirectUrl)


function onException(res, exception, moreData) {
  template = "./template/oops.pug";
  title = "Oops, something went wrong."
  subTitle = "Maybe you are not logged in?"

  console.log('we got an exception:' + exception);
  var options = { title: title, subTitle: subTitle, exception: exception, moreData: moreData };
  var html = pug.renderFile(template, options);
  res.status(500).send(html)
}


var consumer = new oauth.OAuth(
  apiHost + '/oauth/initiate',
  apiHost + '/oauth/token',
  _openbankConsumerKey,
  _openbankConsumerSecret,
  '1.0',                             //rfc oauth 1.0, includes 1.0a
  _openbankRedirectUrl,
  'HMAC-SHA1');

app.use(cookieSession({
  keys: ['kkj289314jd', 'klsj891234'],

  // Cookie Options
  maxAge: 1 * 60 * 60 * 1000 // 24 hours
}))

app.get('/', function (req, res) {
  var template = "./template/index.pug";
  var title = "Home"
  var options = { title: title };
  var html = pug.renderFile(template, options);
  res.status(200).send(html)
});

app.get('/connect', function (req, res) {
  consumer.getOAuthRequestToken(function (error, oauthToken, oauthTokenSecret, results) {
    if (error) {
      res.status(500).send("Error getting OAuth request token : " + util.inspect(error));
    } else {
      req.session.oauthRequestToken = oauthToken;
      req.session.oauthRequestTokenSecret = oauthTokenSecret;
      res.redirect(apiHost + "/oauth/authorize?oauth_token=" + req.session.oauthRequestToken);
    }
  });
});


app.get('/callback', function (req, res) {

  consumer.getOAuthAccessToken(
    req.session.oauthRequestToken,
    req.session.oauthRequestTokenSecret,
    req.query.oauth_verifier,
    function (error, oauthAccessToken, oauthAccessTokenSecret, result) {
      if (error) {
        //oauthAccessToken, -Secret and result are now undefined
        res.status(500).send("Error getting OAuth access token : " + util.inspect(error));
      } else {
        //error is now undefined
        req.session.oauthAccessToken = oauthAccessToken;
        req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
        res.redirect('/signed_in');
      }
    }
  );
});


app.get('/signed_in', function (req, res) {

  var template = "./template/signedIn.pug"
  var options = {}
  var html = pug.renderFile(template, options)
  res.status(200).send(html)

  consumer.get(apiHost + '/obp/v3.1.0/users/current',
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    function (error, data, response) {
      if (error) {
        console.error(error)
      } else {
        console.log(data)
      }
    });

});


app.get('/getCurrentUser', function (req, res) {
  consumer.get(apiHost + "/obp/v3.1.0/users/current",
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    function (error, data, response) {
      try {
        var parsedData = JSON.parse(data);
        res.status(200).send(parsedData)
      } catch (exception) {
        onException(res, exception, data);
      }
    });
});


app.get('/getMyAccountsJson', function (req, res) {
  consumer.get(apiHost + "/obp/v3.0.0/my/accounts",
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    function (error, data, response) {
      try {
        var parsedData = JSON.parse(data);
        res.status(200).send(parsedData)
      } catch (exception) {
        onException(res, exception, data);
      }
    });
});

app.get('/banks/:bankId/accounts/:accountId/transactions', function (req, res) {
  var template = "./template/transactions.pug";
  var title = "Transactions"

  consumer.get(apiHost + `/obp/v3.0.0/my/banks/${req.params.bankId}/accounts/${req.params.accountId}/transactions`,
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    function (error, data, response) {
      try {
        var json = JSON.parse(data);
        var options = { title: title, error: error, json: json, response: response };
        var html = pug.renderFile(template, options);
        res.status(200).send(html)
      } catch (exception) {
        onException(res, exception, data);
      }
    });
});


app.get('/getMyAccounts', function (req, res) {

  var template = "./template/accounts.pug";
  var title = "Accounts"

  consumer.get(apiHost + "/obp/v3.1.0/my/accounts",
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    // When the GET request completes, we call the following function with the data we got back:
    function (error, data, response) {
      //console.log("error is: " + error);
      //console.log("data is: " + data);
      //console.log("response is: " + response);

      try {
        var json = JSON.parse(data);
        //console.log("json is: " + util.inspect(json, false, null))
        var options = { title: title, error: error, json: json, response: response };
        var html = pug.renderFile(template, options);
        res.status(200).send(html)
      } catch (exception) {
        onException(res, exception, data);
      }
    });
});



// Loop through a Customers file, find the User matching email, Post the customer (which links to the User)
app.get('/customer', function (req, res) {

  var template = "./template/loadCustomers.pug";

  consumer.get(apiHost + "/obp/v3.1.0/users/current/customers",
    req.session.oauthAccessToken,
    req.session.oauthAccessTokenSecret,
    function (error, data, response) {
      var parsedData = JSON.parse(data);

      let customer = parsedData.customers[0]
      console.log(customer)

      var html = pug.renderFile(template, { customer })

      res.status(200).send(html)

    });


});


exports.app = functions.https.onRequest(app);
