import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import session from "express-session";
import passport from "passport";
import passportLocalMongoose from "passport-local-mongoose"
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
 
const app = express();
 
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({extended: true}));
app.use(session({
    secret: "Verysecretstring",
    resave: false,
    saveUninitialized: false
}))
 
app.use(passport.initialize());
app.use(passport.session());
 
main().catch(err => console.log(err));
 
async function main() {
    await mongoose.connect("mongodb://0.0.0.0:27017/userDB");
}
 
const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
})
 
userSchema.plugin(passportLocalMongoose);
const User = new mongoose.model("User", userSchema);
 
passport.use(User.createStrategy());
 
passport.serializeUser(function(user, done) {
    done(null, user);
  });
 
passport.deserializeUser(function(user, done) {
    done(null, user);
});
 
passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOne({ googleId: profile.id }).then((foundUser) => {
        if (foundUser) {
          return foundUser;
        } else {
          const newUser = new User({
            googleId: profile.id
          });
          return newUser.save();
        }
      }).then((user) => {
        return cb(null, user);
      }).catch((err) => {
        return cb(err);
      });
  }
));
 
app.listen(3000, function () {
    console.log("Server started on port 3000");
})
 
app.get("/", function (req, res) {
    res.render("home");
})
 
app.get("/auth/google", passport.authenticate("google", { scope: ["profile"] }));
 
app.get("/auth/google/secrets", 
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    res.redirect("/secrets");
  });
 
app.get("/login", function (req, res) {
    res.render("login");
})
 
app.post("/login",
  passport.authenticate("local", { failureRedirect: "/login" }), function(req, res) {
    res.redirect("/secrets");
  }
);
 
app.get("/register", function (req, res) {
    res.render("register");
})
 
app.get("/logout", function (req, res) {
    req.logOut((err) => {});
    res.redirect("/");
})
 
app.post("/register", function(req,res){
    User.register({username: req.body.username}, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/secrets");
            })
        }
    })
});
 
app.get("/secrets", function(req, res) {
        User.find({"secret": {$ne: null}}).then( (foundUsers) =>{
            if(foundUsers){
              res.render("secrets",{usersWithSecrets: foundUsers})
            }
        })
})

app.get("/submit",(req,res)=>{
  if (req.isAuthenticated()) {
    res.render("submit");
} else {
    res.redirect("/login");
}
})

app.post("/submit",(req,res)=>{
  if (req.isAuthenticated()) {
    const submittedSecret = req.body.secret;
    const id = req.user._id.toString();
    async function SubmitSecret(){
      try {
        await User.findById(id).then((foundUser)=>{
          if(foundUser){
            foundUser.secret = submittedSecret;
            foundUser.save().then(res.redirect("/secrets"));
          }
        })
      }
      catch (error){
        console.log(error);
      }
    }
    SubmitSecret();
} else {
    res.redirect("/login");
}
})