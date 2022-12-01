const LocalStrategy = require("passport-local").Strategy;
const {pool} = require("./dbConfig");
const bcrypt = require("bcrypt");
const { authenticate } = require("passport");

function initialize(passport){
    const authenticateUser = (username, password, done)=>{
        pool.query(
            `SELECT * FROM user_information WHERE username = $1 OR email = $1`, [username], (err, results)=>{
                if(err){
                    throw err;
                }
                console.log(results.rows);
                
                if(results.rows.length > 0){
                    const user = results.rows[0];

                    bcrypt.compare(password, user.password_hash, (err, isMatch)=>{
                        if(err){
                            throw err;
                        }
                        if(isMatch){
                            return done(null, user);
                        }
                        else{
                            return done(null, false, {message: "Password is not correct!"});
                        }
                    });
                }else {
                    return done(null, false, {message: "User not registered!"})
                }
            }
        )
    }
    
    passport.use(
        new LocalStrategy(
        {
            usernameField: "username",
            passwordField: "password"
        }, authenticateUser
        )
    );

    passport.serializeUser((user, done)=> done(null, user.user_id));
    passport.deserializeUser((user_id, done)=>{
        pool.query(
            `SELECT * FROM user_information WHERE user_id = $1`, [user_id], (err, results) =>{
                if(err){
                    throw err;
                }
                return done(null, results.rows[0])
            }
        )
    })
}

module.exports = initialize;