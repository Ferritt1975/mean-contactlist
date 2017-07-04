var express = require('express');
var passport = require('passport');
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var LocalStrategy = require('passport-local').Strategy;
var bodyParser = require("body-parser");
var mongodb = require("mongodb");
var ObjectID = mongodb.ObjectID;

var CONTACTS_COLLECTION = "contacts";
var USERS_COLLECTION = "users";

passport.use(new FacebookStrategy({
    clientID: '145826452655768',
    clientSecret: '388560ee4c8d52694ad674617a97e6dd',
    callbackURL: 'https://sheltered-gorge-33033.herokuapp.com/login/facebook/return',
    profileFields: ['id', 'first_name', 'last_name', 'link', 'email']
  },
  function(accessToken, refreshToken, profile, cb) {
    var col = db.collection(USERS_COLLECTION);
    col.findOne({
      'email': profile.emails[0].value
    }, function(err, user) {
      if (err) {
        return cb(err);
      };
      if (!user) {
        var newUser = {
          firstname: profile.name.givenName,
          lastname: profile.name.familyName,
          facebook_id: JSON.stringify(profile.id).replace(/\"/g, ""),
          email: profile.emails[0].value
        };
        if (err) {
          handleError(res, err.message, "Failed to add new user.");
        } else {
          col.insertOne(newUser, function(err, doc) {
            if (err) {
              handleError(res, err.message, "Failed to add new user.");
              res.redirect('/');
            };
            user = newUser;
          });
        }
        return cb(null, newUser);
      } else {
        col.updateOne(
          { 'email': profile.emails[0].value },
          { 
            $set: { 'facebook_id' : profile.id } 
          });
        return cb(null, user);
      }
    });
  }));

passport.use(new TwitterStrategy({
    consumerKey: 'DBGp4rY5y10hoQlKm5aZekLDO',
    consumerSecret: '3BE9glMXWfybwSdpsIPgPco0ePMNKT7se0XpM4DGZYUXDnANMS',
    callbackURL: 'https://sheltered-gorge-33033.herokuapp.com/login/twitter/return',
    userProfileURL: 'https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true',
  },
  function(token, tokenSecret, profile, cb) {
    var col = db.collection(USERS_COLLECTION);
    col.findOne({
      'email': profile.emails[0].value
    }, function(err, user) {
      if (err) {
        return cb(err);
      };
      if (!user) {
        var displayName = JSON.stringify(profile.displayName).replace(/\"/g, "").split(/(?=[A-Z])/);
        var newUser = {
          firstname: displayName[0],
          lastname: displayName[1],
          email: profile.emails[0].value,
          twitter_id: profile.id
        };
        if (err) {
          handleError(res, err.message, "Failed to add new user.");
        } else {
          col.insertOne(newUser, function(err, doc) {
            if (err) {
              handleError(res, err.message, "Failed to add new user.");
              res.redirect('/');
            };
            user = newUser;
          });
        }
        return cb(null, newUser);
      } else {
        col.updateOne(
          { 'email': profile.emails[0].value },
          { 
            $set: { 'twitter_id' : profile.id } 
          });
        return cb(null, user);
      }
    });
  }
));

passport.use(new LocalStrategy({
    usernameField: 'email',
    passwordField: 'password',
  },
  function(token, tokenSecret, cb) {
    var col = db.collection(USERS_COLLECTION);
    col.findOne({
      'email': token,
    }, function(err, user) {
      if (err) {
        return cb(err);
      }
      if (!user) {
        return cb(null, false);
      }
      if (user.password != tokenSecret) {
        return cb(null, false);
      }
      console.log("User " + user + " logged in.");
      return cb(null, user);
    });
  }));

passport.serializeUser(function(user, cb) {
  cb(null, user);
});

passport.deserializeUser(function(obj, cb) {
  cb(null, obj);
});

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
app.use(require('cookie-parser')());
app.use(require('body-parser').urlencoded({
  extended: true
}));
app.use(require('express-session')({
  secret: 'keyboard cat',
  resave: true,
  saveUninitialized: true
}));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(__dirname + '/public'));

// Define routes.
app.get('/',
  function(req, res) {
    res.render('index', {
      user: req.user,
      session: req.session
    });
  });

app.get('/login',
  function(req, res) {
    res.render('login');
  });

app.get('/login/facebook',
  passport.authenticate('facebook', { scope: 'email'}));

app.get('/login/facebook/return',
  passport.authenticate('facebook', {
    failureRedirect: '/'
  }),
  function(req, res, next) {
    req.session.loggedInWith = 'facebook';
    next();
  },
  function(req, res) {
    res.redirect('/');
  });

app.get('/login/twitter',
  passport.authenticate('twitter'));

app.get('/login/twitter/return',
  passport.authenticate('twitter', {
    failureRedirect: '/'
  }),
  function(req, res, next) {
    req.session.loggedInWith = 'facebook';
    next();
  },
  function(req, res) {
    res.redirect('/');
  });

app.post('/login/local',
  passport.authenticate('local', {
    failureRedirect: '/'
  }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/signup',
  function(req, res) {
    res.render('signup');
  });

app.get('/tos',
  function(req, res) {
    res.render('tos');
  });

app.get('/privacy',
  function(req, res) {
    res.render('privacy');
  });

app.post('/signup', function(req, res, next) {
  var newUser = {
    firstname: req.body.firstname,
    lastname: req.body.lastname,
    email: req.body.email,
    password: req.body.password
  };
  var col = db.collection(USERS_COLLECTION);
  var user = col.findOne({
      'email': newUser.email,
    });
  if (!user) {
    col.insertOne(newUser, function(err, doc) {
      if (err) {
        handleError(res, err.message, "Failed to add new user.");
      } else {
        res.redirect('/');
      }
    });
  } else {
    console.log("Email address already exists.");
    res.redirect('/');
  };
});

app.get('/logout', function(req, res) {
  req.session.destroy(function() {
    res.redirect('/');
  });
});

app.get('/profile',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.render('profile', {
      user: req.user
    });
  });

app.get('/list',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.render('list', {
      user: req.user
    });
  });

app.get('/contact',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.render('contact', {
      user: req.user
    });
  });

app.get('/contact-form',
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    res.render('contact-form', {
      user: req.user
    });
  });

// Create a database variable outside of the database connection callback to reuse the connection pool in your app.
var db;

// Connect to the database before starting the application server. 
mongodb.MongoClient.connect(process.env.MONGODB_URI, function(err, database) {
  if (err) {
    console.log(err);
    process.exit(1);
  }

  // Save database object from the callback for reuse.
  db = database;
  console.log("Database connection ready");

  // Initialize the app.
  var server = app.listen(process.env.PORT || 8080, function() {
    var port = server.address().port;
    console.log("App now running on port", port);
  });
});

// CONTACTS API ROUTES BELOW

// Generic error handler used by all endpoints.
function handleError(res, reason, message, code) {
  console.log("ERROR: " + reason);
  res.status(code || 500).json({
    "error": message
  });
}

/*  "/contacts"
 *    GET: finds all contacts
 *    POST: creates a new contact
 */

app.get("/contacts",
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    db.collection(CONTACTS_COLLECTION).find({ 'owner': req.user._id }).toArray(function(err, docs) {
      if (err) {
        handleError(res, err.message, "Failed to get contacts.");
      } else {
        res.status(200).json(docs);
      }
    });
  });

app.post("/contacts",
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    console.log(JSON.stringify(req.body));
    var newContact = req.body;
    newContact.createDate = new Date();
    newContact.owner = req.user._id;

    if (!(req.body.firstName || req.body.lastName)) {
      handleError(res, "Invalid user input", "Must provide a first or last name.", 400);
    }

    db.collection(CONTACTS_COLLECTION).insertOne(newContact, function(err, doc) {
      if (err) {
        handleError(res, err.message, "Failed to create new contact.");
      } else {
        res.status(201).json(doc.ops[0]);
      }
    });
  });

/*  "/contacts/:id"
 *    GET: find contact by id
 *    PUT: update contact by id
 *    DELETE: deletes contact by id
 */

app.get("/contacts/:id",
  require('connect-ensure-login').ensureLoggedIn(),
  function(req, res) {
    db.collection(CONTACTS_COLLECTION).findOne({
      _id: new ObjectID(req.params.id)
    }, function(err, doc) {
      if (err) {
        handleError(res, err.message, "Failed to get contact");
      } else {
        res.status(200).json(doc);
      }
    });
  });

app.put("/contacts/:id", function(req, res) {
  var updateDoc = req.body;
  delete updateDoc._id;

  db.collection(CONTACTS_COLLECTION).updateOne({
    _id: new ObjectID(req.params.id)
  }, updateDoc, function(err, doc) {
    if (err) {
      handleError(res, err.message, "Failed to update contact");
    } else {
      res.status(204).end();
    }
  });
});

app.delete("/contacts/:id", function(req, res) {
  db.collection(CONTACTS_COLLECTION).deleteOne({
    _id: new ObjectID(req.params.id)
  }, function(err, result) {
    if (err) {
      handleError(res, err.message, "Failed to delete contact");
    } else {
      res.status(204).end();
    }
  });
});