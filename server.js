const express = require("express");
const app = express();
const { pool } = require("./dbConfig");
const bcrypt = require("bcrypt");
const session = require("express-session");
const flash = require("express-flash");
const passport = require("passport");
const schedule = require('node-schedule');
const nodemailer = require('nodemailer');
const {Parser} = require('json2csv');

const transporter = nodemailer.createTransport({
    service: process.env.NODEMAILER_SERVICE,
    auth: {
        user: process.env.NODEMAILER_USER,
        pass: process.env.NODEMAILER_PASS
    },
    secureConnection: false,
})

const initializePassport = require("./passportConfig");
const { request } = require("express");
const { render } = require("ejs");
const e = require("express");

initializePassport(passport);

const PORT = process.env.PORT || 1000;

// GLOBAL VAR
const categoryAuthorization = {
    categoryExist: "activated",
    categoryNotExist: "deactivated"
}
const userRoles = {
    ADMIN: 'super',
    REGULAR: 'regular'
}

const checkActivated = {
    ACTIVATED: "activated",
    DEACTIVATED: "deactivated"
}

//middleware

//app.set('views', './views');
app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use(express.urlencoded({extended: false}));
app.use(express.json());

app.use(session({
    secret: 'secret',

    resave: false,

    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(flash());

app.get("/", (req, res) => {
    res.render("login");
});

app.get("/users/register", checkAuthenticated, (req, res)=>{
    res.render("register");
});

app.get("/users/login", checkAuthenticated ,(req, res)=>{
    res.render("login");
});

app.get("/users/dashboard", checkNotAuthenticated, (req, res)=>{
    res.render("dashboard", {user: req.user.full_name, user_role: req.user.user_role});
});

app.get("/users/logout", checkNotAuthenticated, (req, res, next)=>{
    req.logout(function(err){
        if(err){return next(err);}
        req.flash("success_msg", "You have logged out!");
        res.redirect("/users/login");
    });
});

//--------------------------------------------------------------------------CATEGORIES ---------------------------------------------------------------------------------

app.get("/users/category", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    pool.query(
        `SELECT * FROM category WHERE active = $1 ORDER BY category_id`, [categoryAuthorization.categoryExist], (err, results)=>{
            if(err){
                throw err;
            }
           //console.log(results.rows);
            res.render("category", {allCategory: results.rows, user: req.user.full_name, user_role: req.user.user_role}); 
        }
    )  
});

// Detele a category
app.get("/users/category/delete/:category_id", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    pool.query(
        `UPDATE category SET active = $1 WHERE category_id = $2 RETURNING *`, [categoryAuthorization.categoryNotExist, req.params.category_id], (err, results)=>{
            
            if(err){
                throw err;
            }
            console.log("DELETED Successfully");
            let message = `${results.rows[0].category_name} removed!`;
            req.flash("success_msg", message);
            res.redirect("/users/category");
        }
    )
});

// Edit a category
app.get("/users/category/edit/:category_id/:category_name", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    res.render("categoryedit", {category_id: req.params.category_id, category_name: req.params.category_name, user: req.user.full_name, user_role: req.user.user_role});
});

app.post("/users/category/edit/:category_id/:category_name", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    let categoryName = req.body.category_name_modify;
    console.log(categoryName);

    pool.query(
        `SELECT * FROM category`, (err, result)=>{
            if(err){
                throw err;
            }
            let sqlResult = result.rows;
            let bool = false;

            for(let iCount=0; iCount<sqlResult.length; iCount++){
                    if(sqlResult[iCount].category_name.toLowerCase() == categoryName.toLowerCase() && req.params.category_id!=sqlResult[iCount].category_id){
                        bool = true;
                        break;
                }
            }

            if(categoryName.trim().length === 0){
                req.flash("error_msg", "Please input a valid category name!");
                res.render("categoryedit", {category_id: req.params.category_id, category_name: req.params.category_name, user: req.user.full_name, user_role: req.user.user_role});
            }
            else if(bool){
                console.log("Found");
                req.flash("error_msg", "This category already exists in database!");
                res.render("categoryedit", {category_id: req.params.category_id, category_name: req.params.category_name, user: req.user.full_name, user_role: req.user.user_role});
            }
            else{
                pool.query(
                    `UPDATE category SET category_name = $1 WHERE category_id = $2 RETURNING *`, [categoryName, req.params.category_id], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        let message = `Category successfully updated from ${req.params.category_name} to ${categoryName}!`;
                        req.flash("success_msg", message);
                        res.redirect("/users/category");
                    }
                )
            }
        }
    )

    

});

// Add a category
app.post("/users/category/add", checkNotAuthenticated, checkSuperUser, (req, res)=>{

    pool.query(
        `SELECT * FROM category`, (err, results)=>{
    
            if(err){
                throw err;
            }
            
            let sqlResult = results.rows;
            let myResult = req.body;
            let bool = false;
            let bool2 = false;
            let categoryID = 0;

            for(let iCount=0; iCount<sqlResult.length; iCount++){
                    if(sqlResult[iCount].category_name.toLowerCase() == myResult.category_name.toLowerCase()){
                        if(sqlResult[iCount].active == categoryAuthorization.categoryNotExist){
                            bool2 = true;
                        }
                        bool = true;
                        categoryID = sqlResult[iCount].category_id;
                    }
            }

            if(bool){
                console.log("Found");
                if(bool2){
                    req.flash("success_msg", "Category Added!");
                }else{
                    req.flash("error_msg", "Category Already Exists!");
                }
 
                pool.query(
                    `UPDATE category SET active = $1 WHERE category_id = $2`, [categoryAuthorization.categoryExist, categoryID], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        res.redirect("/users/category");                        
                    }
                ) 
            }else{
                pool.query(
                    `INSERT INTO category (category_name, active) VALUES($1, $2)`, [myResult.category_name, categoryAuthorization.categoryExist], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        let message = `${req.body.category_name} category added.`;
                        console.log(message);
                        req.flash("success_msg", message);
                        res.redirect("/users/category"); 
                    }
                )   
            }            
    })
});

//--------------------------------------------------------------------------------MANAGING USERS------------------------------------------------------------------------

app.get("/users/allusers", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    pool.query(
        `SELECT user_id, username, user_role, email, full_name, phone_number, nick_name FROM user_information ORDER BY user_id`, (err, results)=>{
            if(err){
                throw err;
            }
            //console.log(results.rows);
            res.render("allusers", {allUsers: results.rows, user: req.user.full_name, user_role: req.user.user_role}); 
        }
    )  
});

// Add a new user
app.post("/users/allusers/adduser", checkNotAuthenticated, checkSuperUser, async (req, res)=>{
    let {username, fullname, email, role, password, password2, telephone, nickname} = req.body;
    let message = "";
    //console.log(username, fullname, email, role, password, password2, telephone, nickname);

    if(!username.trim() || !fullname.trim() || !email.trim() || !role.trim() || !password.trim() || !password2.trim()){
        message = "Please enter all the fields";
    }else if(password.length < 6){
        message = "Password should be at least 6 characters!";
    }else if(password!=password2){
        message = "Passwords do not match";
    }
    
    if(message.length>1){
        req.flash("error_msg", message);
        res.redirect("/users/allusers");
    }else{
        let hashedPassword = await bcrypt.hash(password, 10);

        pool.query(
            `SELECT * FROM user_information WHERE username ILIKE $1 OR email ILIKE $2`, [username, email], (err, results)=>{
                if(err){
                    throw err;
                }
                //console.log(results.rows);
                if(results.rows.length > 0){
                    message = "User already exists!";
                    req.flash("error_msg", message);
                    res.redirect("/users/allusers");
                    // for(let iCount=0; iCount<results.rows.length; iCount++){
                    //     if(username.toLowerCase() == results.rows[iCount].username.toLowerCase() 
                    //     || email.toLowerCase() == results.rows[iCount].email.toLowerCase()){
                            
                    //         break;
                    //     }
                    // }
                }else{
                    pool.query(
                        `INSERT INTO user_information(username, password_hash, user_role, full_name, email, phone_number, nick_name)
                        VALUES($1, $2, $3, $4, $5, $6, $7)
                        RETURNING *`, [username, hashedPassword, userRoles.REGULAR, fullname, email, telephone, nickname], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            req.flash('success_msg', "New user added!");
                            res.redirect("/users/allusers");
                        }
                    )
                }
            }
        )

    }

});

// Delete a user
app.get('/users/allusers/delete/:user_id', checkNotAuthenticated, checkSuperUser, (req, res)=>{
    pool.query(`SELECT * FROM user_information WHERE user_id = $1`, [req.params.user_id], (err, results)=>{
        if(err){
            throw err;
        }
        if(results.rows[0].user_role == userRoles.ADMIN){
            req.flash('error_msg', "Cannot edit or delete a super user!");
            res.redirect("/users/allusers");
        }else{
            pool.query(`DELETE FROM user_information WHERE user_id = $1`, [req.params.user_id], (err, result)=>{
                if(err){
                    throw err;
                }
                let message = `User "${results.rows[0].full_name}" is successfully deleted!`;
                req.flash('success_msg', message);
                res.redirect("/users/allusers");
                console.log("Deleted");
            })
        }
    })
})

// Edit a user
app.get("/users/allusers/edit/:user_id", checkNotAuthenticated, checkSuperUser, (req, res)=>{
    pool.query(`SELECT * FROM user_information WHERE user_id = $1`, [req.params.user_id], (err,results)=>{
        if(err){
            throw err;
        }
        let theUser = results.rows[0];
        if(theUser.user_role == userRoles.ADMIN){
            req.flash('error_msg', "Cannot edit or delete a super user!");
            res.redirect("/users/allusers");
        }else{
            res.render("allusersedit", {user_id: theUser.user_id, username: theUser.username, full_name: theUser.full_name, 
                email: theUser.email, phone_number: theUser.phone_number, nick_name: theUser.nick_name, user_role: req.user.user_role});
        }
    })
});

app.post("/users/allusers/edit/:user_id", checkNotAuthenticated, checkSuperUser, (req,res)=>{
    let {username, fullname, email, role, telephone, nickname} = req.body;
    let message = "";
    if(!username.trim() || !fullname.trim() || !email.trim() || !role.trim()){
        message = "Please enter appropriate data in the fields!";
        req.flash('error_msg', message);
        let path = `/users/allusers/edit/${req.params.user_id}`;
        res.redirect(path);
    }else{
        pool.query(`SELECT * FROM user_information WHERE username ILIKE $1 OR email ILIKE $2`, [username, email], (err, results)=>{
            if(err){
                throw err;
            }
            console.log(results.rows);
            let theUsers = results.rows;
            let bool = false;
            for(let iCount=0; iCount<theUsers.length; iCount++){
                if(theUsers[iCount].user_id != req.params.user_id){
                    bool = true;
                    break;
                }
            }
            if(bool){
                message = "The username/email already exists. Please use different data!";
                req.flash('error_msg', message);
                let path = `/users/allusers/edit/${req.params.user_id}`;
                res.redirect(path);
            }else{
                pool.query(`UPDATE user_information 
                            SET username = $1,
                                full_name = $2,
                                email = $3,
                                user_role = $4,
                                phone_number = $5,
                                nick_name = $6
                            WHERE user_id = $7`, [username, fullname, email, role, telephone, nickname, req.params.user_id], (err, results)=>{
                                if(err){
                                    throw err;
                                }
                                req.flash('success_msg', "User Updated!");
                                res.redirect("/users/allusers");
                            })
            }
        })
    }
})

//--------------------------------------------------------------------------------BUDGET SYSTEM-------------------------------------------------------------------------
// Display Budget
app.get('/users/startmonth', checkNotAuthenticated, checkSuperUser, displayBudget(checkActivated.DEACTIVATED, '/users/startmonth'));

// Adding budget item before starting the month
app.post('/users/startmonth/additem', checkNotAuthenticated, checkSuperUser, checkIfMonthStarted, addBudget(checkActivated.DEACTIVATED, '/users/startmonth'))

// Deleting budget item (USED FOR BOTH MANAGING AND STARTING MONTH BUDGET)
app.get('/users/startmonth/deleteitem/:category_id', checkNotAuthenticated, checkSuperUser, checkIfMonthStarted, deleteBudget(checkActivated.DEACTIVATED, '/users/startmonth'));

// Editing budget item (USED FOR BOTH MANAGING AND STARTING MONTH BUDGET)
app.get('/users/startmonth/edititem/:category_id', checkNotAuthenticated, checkSuperUser, checkIfMonthStarted, (req, res)=>{
    let myPath = 'startmonth';
    pool.query(`SELECT * FROM category WHERE category_id = $1`, [req.params.category_id], (err, results)=>{
        if(err){
            throw err;
        }
        if(results.rows.length>0){
            res.render('budgetedit', {category_id: results.rows[0].category_id, category_name: results.rows[0].category_name, thisPath: myPath, user_role: req.user.user_role});
        }
        else{
            req.flash('error_msg', "Something Wrong!");
            res.redirect("/users/startmonth");
        }
    })
})

app.post('/users/startmonth/edititem/:category_id/:category_name', checkNotAuthenticated, checkSuperUser, checkIfMonthStarted, editBudget(checkActivated.DEACTIVATED, '/users/startmonth'));


// Starting the month
app.post('/users/startmonth/submit', checkNotAuthenticated, checkSuperUser, checkIfMonthStarted, (req, res)=>{
    pool.query(`UPDATE budget_data
                SET active = $1
                WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
                AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)
                AND active = $2 RETURNING *`, [checkActivated.ACTIVATED, checkActivated.DEACTIVATED], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    if(results.rows.length > 0){
                        pool.query(`INSERT INTO start_month_log (user_id, time_month_started)
                                    VALUES ($1, NOW())`, [req.user.user_id], (err, results)=>{
                                        if(err){
                                            throw err;
                                        }
                                        req.flash('success_msg', "Month Started!");
                                        res.redirect("/users/startmonth");
                                    })
                    }else{
                        req.flash('error_msg', "No budget items defined to start the month!");
                        res.redirect("/users/startmonth");
                    }
                })
})

//---------------------------------------------------------------------------------MANAGE BUDGET------------------------------------------------------------------------

app.get('/users/managebudget', checkNotAuthenticated, checkSuperUser, displayBudget(checkActivated.ACTIVATED, '/users/managebudget'));

// Add item when managing budget
app.post('/users/managebudget/additem', checkNotAuthenticated, checkSuperUser, checkIfMonthNotStarted("/users/managebudget"), addBudget(checkActivated.ACTIVATED, '/users/managebudget'));

// Delete item when managing budget
app.get('/users/managebudget/deleteitem/:category_id', checkNotAuthenticated, checkSuperUser, checkIfMonthNotStarted("/users/managebudget"), deleteBudget(checkActivated.ACTIVATED, '/users/managebudget'));

// Edit budget when managing budget
app.get('/users/managebudget/edititem/:category_id', checkNotAuthenticated, checkSuperUser, checkIfMonthNotStarted("/users/managebudget"), (req, res)=>{
    let myPath='managebudget';
    pool.query(`SELECT * FROM category WHERE category_id = $1`, [req.params.category_id], (err, results)=>{
        if(err){
            throw err;
        }
        if(results.rows.length>0){
            res.render('budgetedit', {category_id: results.rows[0].category_id, category_name: results.rows[0].category_name, thisPath: myPath, user_role: req.user.user_role});
        }
        else{
            req.flash('error_msg', "Something Wrong!");
            res.redirect("/users/managebudget");
        }
    })
})
app.post('/users/managebudget/edititem/:category_id/:category_name', checkNotAuthenticated, checkSuperUser, checkIfMonthNotStarted("/users/managebudget"), editBudget(checkActivated.ACTIVATED, '/users/managebudget'));

// Edit budget function
function editBudget(active, thePath){
    return (req, res)=>{
        let {budget} = req.body;
        //console.log(budget);
        pool.query(`UPDATE budget_data
                    SET budget = $1
                    WHERE category_id = $2
                    AND EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)
                    RETURNING *`, 
                    [budget, req.params.category_id], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        let message = `The budget value is updated for category ${req.params.category_name}!`;
                        req.flash('success_msg', message);
                        res.redirect(thePath);
                    })
    }
}

// Delete budget function
function deleteBudget(active, thePath){
    return (req, res)=>{
        pool.query(`SELECT * FROM budget_data WHERE category_id = $1 
                    AND EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)`, 
                    [req.params.category_id], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        if(results.rows.length > 1){
                            console.log("Something Wrong");
                            req.flash('error_msg', "Something is wrong!");
                            res.redirect(thePath);
                        }
                        else{
                            pool.query(`DELETE FROM budget_data WHERE category_id = $1 
                                    AND EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
                                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)`, [req.params.category_id], (err, results)=>{
                                        if(err){
                                            throw err;
                                        }
                                        req.flash('success_msg', "The budget item is deleted!");
                                        res.redirect(thePath);
                                    })
                        }
                    })
    }
}

// Add budget functions
function addBudget(active, thePath){
    return (req, res)=>{

        let {category, budget} = req.body;
        console.log(category, budget);
    
        pool.query(`SELECT * FROM budget_data 
                    WHERE category_id = $1 
                    AND EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)`, [category], (err, results)=>{
                        if(err){
                            throw err;
                        }
    
                        if(results.rows.length>0){
                            req.flash('error_msg', "The budget for this category already exists!");
                            res.redirect(thePath);
                        }
                        else{
                            pool.query(`INSERT INTO budget_data(user_id, time_created, category_id, budget, active)
                            VALUES ($1, NOW(), $2, $3, $4)`, [req.user.user_id, category, budget, active], (err, results)=>{
                                if(err){
                                    throw err;
                                }
                                req.flash('success_msg', "The budget is added!");
                                res.redirect(thePath);
                            })
                        }
                    })
    
    }
}

// Display budget function
function displayBudget(active, thePath){
    return (req, res)=>{

        pool.query(`SELECT budget_data.user_id, budget_data.time_created, budget_data.category_id, budget_data.budget, budget_data.active, category.category_name
        FROM budget_data LEFT JOIN category ON budget_data.category_id = category.category_id
        WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_created) 
        AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_created)
        AND budget_data.active = $1`, [active], (err, results)=>{
            if(err){
                throw err;
            }

            let categoryResults;

            pool.query(`SELECT category_id, category_name FROM category WHERE active = $1`, [categoryAuthorization.categoryExist], (err, result)=>{
                if(err){
                    throw err;
                }
                categoryResults = result.rows;
                if(thePath == '/users/managebudget'){
                    res.render('managebudget', {user: req.user.full_name, allBudget: results.rows, allCategory: categoryResults, user_role: req.user.user_role});
                }
                else if(thePath == '/users/startmonth'){
                    res.render('startmonth', {user: req.user.full_name, allBudget: results.rows, allCategory: categoryResults, user_role: req.user.user_role});
                }
            })
            
        })
    }
}

//-----------------------------------------------------------------------------------SPENDINGS--------------------------------------------------------------------------

app.get('/users/spending', checkNotAuthenticated, (req, res)=>{
    
    let userSpending;
    let availableCategories;
    
    pool.query(`SELECT spending_data.category_id, spending_data.time_of_entry, category.category_name, spending_data.spending, spending_data.spending_date::DATE 
        FROM spending_data LEFT JOIN category ON spending_data.category_id = category.category_id
        WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM spending_data.spending_date) 
        AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM spending_data.spending_date)
        AND user_id = $1`, [req.user.user_id], (err, results)=>{
        if(err){
            throw err;
        }
        
        userSpending = results.rows;

        pool.query(`SELECT category_id, category_name FROM category 
                    WHERE category_id IN 
                    (SELECT category_id 
                    FROM budget_data WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT(YEAR FROM time_created) 
                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT(MONTH FROM time_created)
                    AND budget_data.active = $1)`, [checkActivated.ACTIVATED], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    availableCategories = results.rows;
                    res.render('spending', {userSpending: userSpending, allCategory: availableCategories, user: req.user.full_name, 
                                            user_role: req.user.user_role})
        })
    })   
})

// Adding the spending data
app.post('/users/spending/add', checkNotAuthenticated, checkIfMonthNotStarted("/users/spending"), (req, res, next)=>{
    let {category, spending, spending_date} = req.body;
    
    let spendingDate = new Date(spending_date);
    let thisDate = new Date();
    thisDate.setHours(thisDate.getHours()-8)

    if(category==null){
        req.flash('error_msg', "Please choose a valid category!");
        return res.redirect('/users/spending');
    }
    else if(spendingDate.getFullYear() == thisDate.getFullYear() && 
        spendingDate.getUTCMonth() == thisDate.getUTCMonth() &&
        spendingDate.getUTCDate() <= thisDate.getUTCDate() &&
        spendingDate.getUTCDate() >=1){
            pool.query(`INSERT INTO spending_data(user_id, time_of_entry, category_id, spending, spending_date)
                    VALUES ($1, NOW(), $2, $3, $4)`, [req.user.user_id, category, spending, spending_date], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        req.flash('success_msg', "Spending added!");
                        res.redirect('/users/spending');
                        return next();
                    }) 
    }else{
        req.flash('error_msg', "Please input only this month's date (today or before today's date)!");
        return res.redirect('/users/spending');
    }

}, sendNotificationMessage())

// Deleting the spending data
app.get('/users/spending/deleteitem/:category_id/:time_of_entry', checkNotAuthenticated, checkIfMonthNotStarted("/users/spending"), (req, res)=>{
    // Can also use the following fuctions
    // let myDate = new Date(req.params.time_of_entry);
    // myDate.setHours(myDate.getHours()-8);
    // console.log(req.params.time_of_entry);
    // console.log(myDate);
    let datey = req.params.time_of_entry.split('G')[0];
    pool.query(`DELETE FROM spending_data 
                WHERE category_id = $1
                AND date_trunc('second', time_of_entry) = $2
                AND user_id = $3`, [req.params.category_id, datey, req.user.user_id], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    req.flash('success_msg', "Spending deleted!");
                    res.redirect('/users/spending');
                })
})

// Editing the spending data
app.get('/users/spending/edititem/:category_id/:time_of_entry', checkNotAuthenticated, checkIfMonthNotStarted("/users/spending"), (req, res)=>{
    let datey = req.params.time_of_entry.split('G')[0];
    pool.query(`SELECT * FROM spending_data
                WHERE category_id = $1
                AND date_trunc('second', time_of_entry) = $2
                AND user_id = $3`, [req.params.category_id, datey, req.user.user_id], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    let myResult = results.rows[0];

                    pool.query(`SELECT category_id, category_name FROM category 
                    WHERE category_id IN 
                    (SELECT category_id 
                    FROM budget_data WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT(YEAR FROM time_created) 
                    AND EXTRACT(MONTH FROM NOW()) = EXTRACT(MONTH FROM time_created)
                    AND budget_data.active = $1)`, [checkActivated.ACTIVATED], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        let availableCategories = results.rows;
                        res.render('spendingedit', {category_id: myResult.category_id, time_of_entry: myResult.time_of_entry,
                            spending: myResult.spending, spending_date: myResult.spending_date, allCategory: availableCategories});
                    })
                    
                })
})

app.post('/users/spending/edititem/:category_id/:time_of_entry', checkNotAuthenticated, checkIfMonthNotStarted("/users/spending"), (req, res, next)=>{
    let datey = req.params.time_of_entry.split('G')[0];
    let {category, spending, spending_date} = req.body;

    let spendingDate = new Date(spending_date);
    let thisDate = new Date();
    thisDate.setHours(thisDate.getHours()-8)

    if(spendingDate.getFullYear() == thisDate.getFullYear() && 
        spendingDate.getUTCMonth() == thisDate.getUTCMonth() &&
        spendingDate.getUTCDate() <= thisDate.getUTCDate() &&
        spendingDate.getUTCDate() >=1 ){
            pool.query(`UPDATE spending_data
                SET category_id = $1,
                spending = $2,
                spending_date = $3
                WHERE category_id = $4
                AND date_trunc('second', time_of_entry) = $5
                AND user_id = $6`, [category, spending, spending_date, req.params.category_id, datey, req.user.user_id], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    req.flash('success_msg', "Spending edited!");
                    res.redirect('/users/spending');
                    return next();
                })
    }else{
        req.flash('error_msg', "Please input only this month's date (today or before today's date)!");
        let myPath = `/users/spending/edititem/${req.params.category_id}/${req.params.time_of_entry}`
        return res.redirect(myPath);
    }  
}, sendNotificationMessage())

//--------------------------------------------------------------------------------ALL SPENDINGS-------------------------------------------------------------------------

app.get('/users/allspending', checkNotAuthenticated, checkSuperUser, viewTheSpendings('get'));

// View according to given month and year
app.post('/users/allspending', checkNotAuthenticated, checkSuperUser, viewTheSpendings('post'));

function viewTheSpendings(methodType){
    return (req, res, next)=>{
        let {theMonth, theYear}=req.body;
        let bool=false;
        if(methodType == 'get'){
            theMonth = getThisMonth();
            theYear = getThisYear();
        }
        if(methodType == 'post2'){
            theMonth = req.myNewMonth;
            theYear = req.myNewYear;
        }
        if(theMonth==null || theYear==null){
            theMonth = getThisMonth();
            theYear = getThisYear();
            bool=true;
        }
        //console.log(theMonth, theYear);
        pool.query(`SELECT user_information.full_name, spending_data.user_id, spending_data.time_of_entry, spending_data.category_id, spending_data.spending,
        spending_data.spending_date, category.category_name, user_information.full_name
        FROM spending_data 
        LEFT JOIN category ON spending_data.category_id = category.category_id
        LEFT JOIN user_information ON spending_data.user_id = user_information.user_id
        WHERE EXTRACT(YEAR FROM spending_data.spending_date) = $1
        AND EXTRACT(MONTH FROM spending_data.spending_date) = $2
        ORDER BY spending_data.user_id, spending_data.spending_date`, [theYear, theMonth], (err, results)=>{
            if(err){
                throw err;
            }
            let allSpendingData = results.rows;
            pool.query(`SELECT user_id, full_name FROM user_information`, (err, results)=>{
                if(err){
                    throw err;
                }
                let allUsers = results.rows;
                pool.query(`SELECT * FROM category WHERE active = $1`, [categoryAuthorization.categoryExist], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    let allCategory = results.rows;
                    if(bool){
                        req.flash('error_msg1', "Please select a valid Year/Month!");
                        res.render('allspending', {user: req.user.full_name, user_role: req.user.user_role, allSpendingData, allUsers, allCategory, theMonth, theYear});
                    }else{
                        res.render('allspending', {user: req.user.full_name, user_role: req.user.user_role, allSpendingData, allUsers, allCategory, theMonth, theYear});
                    }
                    next();        
                })
            })
        })         
}}
// Adding spending
app.post('/users/allspending/add', checkNotAuthenticated, checkSuperUser, addAllSpending(), viewTheSpendings('post2'), sendNotificationMessage());
////////If using just function(req, res, next)
////////only use addAllSpending above
////////otherwise use addAllSpending()
function addAllSpending(){
    return (req, res, next)=>{
        let {theUser, category, spending, spending_date} = req.body;

        let spendingDate = new Date(spending_date);
        let thisDate = new Date();
        thisDate.setHours(thisDate.getHours()-8)

        req.myNewMonth = spendingDate.getUTCMonth()+1;
        req.myNewYear = spendingDate.getUTCFullYear();
        
        if(theUser==null || category==null){
            req.flash('error_msg2', "Please select a valid User/Category!");
            next();
        }else{
            if((spendingDate.getFullYear() <= thisDate.getFullYear() && 
                spendingDate.getUTCMonth() < thisDate.getUTCMonth()) ||
                spendingDate.getUTCDate() <= thisDate.getUTCDate()){
                    pool.query(`INSERT INTO spending_data(user_id, time_of_entry, category_id, spending, spending_date)
                                VALUES($1, NOW(), $2, $3, $4)`, [theUser, category, spending, spending_date], (err, results)=>{
                                    if(err){
                                        throw err;
                                    }
                                    next();
                                })
            }else{
                req.flash('error_msg2', "Cannot enter future date!");
                next();
            }
        }     
}}

// Editing spending
app.get(`/users/spending/edititem/:category_id/:time_of_entry/:user_id`, checkNotAuthenticated, checkSuperUser, (req,res)=>{
    let datey = req.params.time_of_entry.split('G')[0];
    console.log(req.params.user_id, req.params.category_id, datey);
    pool.query(`SELECT spending_data.user_id, spending_data.time_of_entry, spending_data.category_id, spending_data.spending,
                spending_data.spending_date, category.category_name, user_information.full_name
                FROM spending_data 
                LEFT JOIN category ON spending_data.category_id = category.category_id
                LEFT JOIN user_information ON spending_data.user_id = user_information.user_id
                WHERE spending_data.user_id = $1
                AND spending_data.category_id = $2
                AND date_trunc('second', spending_data.time_of_entry) = $3`, [req.params.user_id, req.params.category_id, datey], (err, results)=>{
                    console.log("first");
                    if(err){
                        throw err;
                    }
                    let spendingToEdit= results.rows[0];
                    pool.query(`SELECT user_id, full_name FROM user_information`, (err, results)=>{
                        console.log("second");
                        if(err){
                            throw err;
                        }
                        let allUsers = results.rows;
                        pool.query(`SELECT * FROM category WHERE active = $1`, [categoryAuthorization.categoryExist], (err,results)=>{
                            console.log("third");
                            if(err){
                                throw err;
                            }
                            let allCategory = results.rows;
                            res.render(`allspendingedit`, {spendingToEdit, allUsers, allCategory, user: req.user.full_name, user_role: req.user.user_role});
                        })
                    })
                    
                })
})

app.post('/users/allspending/edit/:category_id/:time_of_entry/:user_id', checkNotAuthenticated, checkSuperUser, async (req,res,next)=>{
    let datey = req.params.time_of_entry.split('G')[0];    
    let {theUser, category, spending, spending_date} = req.body;

    if(category == null){
        req.flash('error_msg2', "Please select a valid category");
        let thePath = `/users/spending/edititem/${req.params.category_id}/${req.params.time_of_entry}/${req.params.user_id}`;
        return res.redirect(thePath);
    }else{
        let spendingDate = new Date(spending_date);
        let thisDate = new Date();
        thisDate.setHours(thisDate.getHours()-8);

        req.myNewMonth = spendingDate.getUTCMonth()+1;
        req.myNewYear = spendingDate.getUTCFullYear();

        if((spendingDate.getFullYear() <= thisDate.getFullYear() && 
            spendingDate.getUTCMonth() < thisDate.getUTCMonth()) ||
            spendingDate.getUTCDate() <= thisDate.getUTCDate()){
            let abc =  await new Promise((resolve)=> {pool.query(`UPDATE spending_data
                            SET user_id = $1,
                            category_id = $2,
                            spending = $3,
                            spending_date = $4
                            WHERE category_id = $5
                            AND date_trunc('second', time_of_entry) = $6
                            AND user_id = $7`, [theUser, category, spending, spending_date, req.params.category_id, datey, req.params.user_id],
                            (err, results)=>{
                                if(err){
                                    throw err;
                                }
                                req.flash('success_msg2', "Spending Edited!");
                                next();
                            });})

        }else{
            req.flash('error_msg2', "Cannot enter future date!");
            let thePath = `/users/spending/edititem/${req.params.category_id}/${req.params.time_of_entry}/${req.params.user_id}`;
            return res.redirect(thePath);
        }
    }
        
}, viewTheSpendings("post2"), sendNotificationMessage());

// Delete
app.get('/users/spending/deleteitem/:category_id/:time_of_entry/:user_id/:spending_date', checkNotAuthenticated, checkSuperUser, (req,res,next)=>{
    let datey = req.params.time_of_entry.split('G')[0];
    console.log(req.params.time_of_entry)

    let spendingDate = new Date(req.params.spending_date);

    req.myNewMonth = spendingDate.getUTCMonth()+1;
    req.myNewYear = spendingDate.getFullYear();

    let dt = new Date();
    dt.setHours(dt.getHours() - 8);
    console.log(spendingDate, dt)

    if(spendingDate.getUTCMonth() == dt.getUTCMonth() && spendingDate.getFullYear() == dt.getFullYear()){
        pool.query(`DELETE FROM spending_data
                WHERE category_id = $1
                AND date_trunc('second', time_of_entry) = $2
                AND user_id = $3`, [req.params.category_id, datey, req.params.user_id], (err, results)=>{
                    if(err){
                        throw err;
                    }
                    
                    req.flash('success_msg2', "Spending Deleted!");
                    return next();
        })
    } else{
        req.flash('error_msg2', "NOT AUTHORIZED TO DELETE PREVIOUS MONTH'S DATA!");
        return next();
    }
}, viewTheSpendings('post2'))

//----------------------------------------------------------------------------VIEW PERSONAL SPENDING--------------------------------------------------------------------

app.get('/users/viewspending', checkNotAuthenticated, viewSpending('get'));

app.post('/users/viewspending', checkNotAuthenticated, viewSpending('post'));

function viewSpending(methodType){
    return (req, res)=>{
        let {theMonth, theYear}=req.body;
        let bool=false;
        if(methodType == 'get'){
            theMonth = getThisMonth();
            theYear = getThisYear();
        }
        if(theMonth==null || theYear==null){
            theMonth = getThisMonth();
            theYear = getThisYear();
            bool=true;
        }
        //console.log(theMonth, theYear);
        pool.query(`SELECT spending_data.user_id, spending_data.time_of_entry, spending_data.category_id, spending_data.spending,
        spending_data.spending_date, category.category_name
        FROM spending_data 
        LEFT JOIN category ON spending_data.category_id = category.category_id
        WHERE EXTRACT(YEAR FROM spending_data.spending_date) = $1
        AND EXTRACT(MONTH FROM spending_data.spending_date) = $2
        AND spending_data.user_id = $3
        ORDER BY category.category_name, spending_data.spending_date`, [theYear, theMonth, req.user.user_id], (err, results)=>{
            if(err){
                return err;
            }
            let allSpendingData = results.rows;
            //console.log("1");
            pool.query(`SELECT category.category_name, SUM(spending_data.spending) AS total FROM spending_data
                        LEFT JOIN category ON spending_data.category_id = category.category_id
                        WHERE EXTRACT(YEAR FROM spending_data.spending_date) = $1
                        AND EXTRACT(MONTH FROM spending_data.spending_date) = $2
                        AND spending_data.user_id = $3
                        GROUP BY(category_name)
                        ORDER BY category.category_name`, [theYear, theMonth, req.user.user_id], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            let totalSpendingData = results.rows;
                            //console.log("2");
                            if(bool){
                                req.flash('error_msg1', "Please select a valid Year/Month!");
                                res.render('viewspending', {user: req.user.full_name, user_role: req.user.user_role, allSpendingData, totalSpendingData, theMonth, theYear});
                            }else{
                                res.render('viewspending', {user: req.user.full_name, user_role: req.user.user_role, allSpendingData, totalSpendingData, theMonth, theYear});
                            }
                        })  

        })         
}}

//------------------------------------------------------------------------------------PROFILE---------------------------------------------------------------------------

app.get(`/users/profile`, checkNotAuthenticated, (req, res)=>{
    pool.query(`SELECT * FROM user_information WHERE user_id = $1`, [req.user.user_id], (err, results)=>{
        if(err){
            throw err;
        }
        res.render('profile', {user: results.rows[0].full_name, user_role: results.rows[0].user_role, username: results.rows[0].username, 
            email: results.rows[0].email, phone_number: results.rows[0].phone_number, nick_name: results.rows[0].nick_name})
    })
})

app.post('/users/profile', checkNotAuthenticated, (req, res)=>{
    let {username, fullname, email, telephone, nickname} = req.body;
    let message = "";
    if(!username.trim() || !fullname.trim() || !email.trim()){
        message = "Please enter appropriate data in the fields!";
        req.flash('error_msg', message);
        let path = `/users/profile`;
        res.redirect(path);
    }else{
        pool.query(`SELECT * FROM user_information WHERE username ILIKE $1 OR email ILIKE $2`, [username, email], (err, results)=>{
            if(err){
                throw err;
            }
            console.log(results.rows);
            let theUsers = results.rows;
            let bool = false;
            console.log(bool);
            for(let iCount=0; iCount<theUsers.length; iCount++){
                if(theUsers[iCount].user_id != req.user.user_id){
                    bool = true;
                    break;
                }
            }
            console.log(bool);
            if(bool){
                message = "The username/email already exists. Please use different data!";
                req.flash('error_msg', message);
                let path = `/users/profile`;
                res.redirect(path);
            }else{
                pool.query(`UPDATE user_information 
                            SET username = $1,
                                full_name = $2,
                                email = $3,
                                phone_number = $4,
                                nick_name = $5
                            WHERE user_id = $6`, [username, fullname, email, telephone, nickname, req.user.user_id], (err, results)=>{
                                if(err){
                                    throw err;
                                }
                                req.flash('success_msg', "Profile Updated!");
                                res.redirect("/users/profile");
                            })
            }
        })
    }

})

app.get('/users/profile/password', checkNotAuthenticated, (req,res)=>{
    res.render('passwordchange');
})

app.post('/users/profile/password', checkNotAuthenticated, async(req, res)=>{
    let {prevpassword, password, password2} = req.body;
    if(!prevpassword || !password || !password2){
        req.flash('error_msg', "Please input all fields!")
        return res.redirect('/users/profile/password');
    }else{
        bcrypt.compare(prevpassword, req.user.password_hash, async (err, isMatch)=>{
            if(err){
                throw err;
            }
            if(isMatch){

                if(password.length < 6){
                    req.flash('error_msg', "Password should be at least 6 characters!");
                    return res.redirect('/users/profile/password');
                }else if(password!=password2){
                    req.flash('error_msg', "Passwords do not match!");
                    return res.redirect('/users/profile/password');
                }else{
                    // Form validation passed
                    let hashedPassword = await bcrypt.hash(password, 10);
                    pool.query(`UPDATE user_information SET password_hash = $1
                        WHERE user_id = $2`, [hashedPassword, req.user.user_id], (err, results)=>{
                        if(err){
                            throw err;
                        }
                    })
                    console.log(hashedPassword);
                    req.flash('success_msg', "Password Changed Successfully")
                    return res.redirect('/users/profile');
                }
            } else{
                req.flash('error_msg', "Old password does not match!")
                return res.redirect('/users/profile/password');
            }
        });   
    }
})

//----------------------------------------------------------------------------------BUDGET VIEW-------------------------------------------------------------------------

app.get('/users/viewbudget', checkNotAuthenticated, viewBudget('get'));
app.post('/users/viewbudget', checkNotAuthenticated, viewBudget('post'));

function viewBudget(methodType){
    return (req,res)=>{
        let {theMonth, theYear}=req.body;
        let bool=false;
        if(methodType == 'get'){
            theMonth = getThisMonth();
            theYear = getThisYear();
        }
        if(theMonth==null || theYear==null){
            theMonth = getThisMonth();
            theYear = getThisYear();
            bool=true;
        }
        //console.log(theMonth, theYear);
        pool.query(`SELECT category.category_name, budget_data.budget 
                    FROM budget_data LEFT JOIN category
                    ON budget_data.category_id = category.category_id
                    WHERE EXTRACT(YEAR FROM budget_data.time_created) = $1
                    AND EXTRACT(MONTH FROM budget_data.time_created) = $2`, [theYear, theMonth], (err, results)=>{
                        if(err){
                            throw err;
                        }
                        let budgetInfo = results.rows;
                        if(bool){
                            req.flash('error_msg1', "Please select a valid Year/Month!");
                            res.render('viewbudget', {user: req.user.full_name, user_role: req.user.user_role, budgetInfo, theMonth, theYear});
                        }else{
                            res.render('viewbudget', {user: req.user.full_name, user_role: req.user.user_role, budgetInfo, theMonth, theYear});
                        }
                    })
    }
}

//-------------------------------------------------------------------------------GENERATE REPORTS-----------------------------------------------------------------------
app.get('/users/generatereport', checkNotAuthenticated, checkSuperUser, viewReport('get'));

function viewReport(methodType){
    return async(req, res, next)=>{
        console.log("Hi");
        let {theMonth, theYear}=req.body;
        let bool=false;
        
        let d = new Date();
        d.setHours(d.getHours() - 8);
        d.setUTCMonth(d.getUTCMonth() - 1);

        
            req.reportOne = await new Promise((resolve) => {
                pool.query(`SELECT (SELECT SUM(budget) FROM budget_data
                        WHERE EXTRACT(YEAR FROM time_created) = EXTRACT(YEAR FROM NOW())
                        AND EXTRACT(MONTH FROM time_created) = EXTRACT(MONTH FROM NOW())) AS total_budget,
                        (SELECT SUM(spending) FROM spending_data
                        WHERE EXTRACT(YEAR FROM spending_date) = EXTRACT(YEAR FROM NOW())
                        AND EXTRACT(MONTH FROM spending_date) = EXTRACT(MONTH FROM NOW())) AS total_spending`, (err, results)=>{
                            if(err){
                                throw err;
                            }
                            resolve(results.rows);
                        })
            } )

            req.reportTwo = await new Promise((resolve) => {
                pool.query(`SELECT category.category_id AS categoryid, category.category_name AS categoryname, budget, 
                            CASE
                                WHEN spendings IS NULL THEN 0
                                ELSE spendings
                            END as spendings
                            FROM (SELECT budget, spendings, mybudget.category_id FROM (SELECT budget, category_id FROM budget_data
                            WHERE EXTRACT(YEAR FROM time_created) = EXTRACT(YEAR FROM NOW())
                            AND EXTRACT(MONTH FROM time_created) = EXTRACT(MONTH FROM NOW())) mybudget LEFT JOIN
                            (SELECT category_id, SUM(spending) AS spendings FROM spending_data
                            WHERE EXTRACT(YEAR FROM spending_date) = EXTRACT(YEAR FROM NOW())
                            AND EXTRACT(MONTH FROM spending_date) = EXTRACT(MONTH FROM NOW())
                            GROUP BY category_id) myspending 
                            ON mybudget.category_id = myspending.category_id) thetable
                            LEFT JOIN 
                            category ON thetable.category_id = category.category_id ORDER BY categoryid`, (err, results)=>{
                            if(err){
                                throw err;
                            }
                            resolve(results.rows);
                        })
            } )

            req.reportThree = await new Promise((resolve) => {
                pool.query(`SELECT CASE
                WHEN mytable.category_name IS NULL THEN mytabletwo.category_name
                ELSE mytable.category_name
            END AS categoryname, 
            CASE
                WHEN mytable.spending IS NULL THEN 0
                ELSE mytable.spending
            END AS thisspending,
            CASE
                WHEN mytabletwo.spending IS NULL THEN 0
                ELSE mytabletwo.spending
            END AS previousspending
    FROM (SELECT category_name, category.category_id, spending FROM (SELECT category_id, SUM(spending) AS spending FROM spending_data 
    WHERE EXTRACT(YEAR FROM spending_date) = EXTRACT(YEAR FROM NOW())
    AND EXTRACT(MONTH FROM spending_date) = EXTRACT(MONTH FROM NOW())
    GROUP BY category_id) tableone 
    LEFT JOIN category ON tableone.category_id = category.category_id) mytable
    FULL JOIN
    (SELECT category_name, category.category_id, spending FROM (SELECT category_id, SUM(spending) AS spending FROM spending_data 
    WHERE EXTRACT(YEAR FROM spending_date) = $1
    AND EXTRACT(MONTH FROM spending_date) = $2
    GROUP BY category_id) tableone 
    LEFT JOIN category ON tableone.category_id = category.category_id) mytabletwo
    ON mytable.category_id = mytabletwo.category_id
    ORDER BY categoryname;`, [d.getFullYear(), d.getUTCMonth()+1], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            console.log(d.getFullYear(), d.getUTCMonth())
                            resolve(results.rows);
                        })
            })

            // req.reportThree2 = await new Promise((resolve) => {
            //     pool.query(`SELECT category.category_id, category.category_name, SUM(spending) AS spendings 
            //                 FROM spending_data LEFT JOIN category ON category.category_id = spending_data.category_id
            //                 WHERE EXTRACT(YEAR FROM spending_date) = $1
            //                 AND EXTRACT(MONTH FROM spending_date) = $2
            //                 GROUP BY category.category_id`, [d.getFullYear(), d.getUTCMonth()], (err, results)=>{
            //                 if(err){
            //                     throw err;
            //                 }
            //                 resolve(results.rows);
            //             })
            // })

            req.reportFour = await new Promise((resolve) => {
                pool.query(`SELECT tableone.category_name, tableone.budget, 
                TO_CHAR(TO_DATE (tableone.themonth::text, 'MM'), 'Mon') AS themonth,
                SUM(CASE
                    WHEN tabletwo.spending IS NULL THEN 0
                    ELSE tabletwo.spending
                END)
                AS spending
                FROM (SELECT budget_data.category_id, category.category_name, budget_data.budget,
                EXTRACT(MONTH FROM time_created) AS themonth FROM budget_data
                LEFT JOIN category ON category.category_id = budget_data.category_id
                WHERE EXTRACT(MONTH FROM time_created) BETWEEN EXTRACT(MONTH FROM NOW() - INTERVAL '3 months')
                AND EXTRACT(MONTH FROM NOW() - INTERVAL '1 months')) tableone
                LEFT JOIN 
                (SELECT *, EXTRACT(MONTH FROM spending_date) AS themonth FROM spending_data
                WHERE EXTRACT(MONTH FROM spending_date) BETWEEN EXTRACT(MONTH FROM NOW() - INTERVAL '3 months')
                AND EXTRACT(MONTH FROM NOW() - INTERVAL '1 months')) tabletwo
                ON tableone.category_id = tabletwo.category_id AND tableone.themonth = tabletwo.themonth
                GROUP BY category_name, tableone.themonth, budget
                HAVING budget*0.9 <= SUM(CASE
                    WHEN tabletwo.spending IS NULL THEN 0
                    ELSE tabletwo.spending
                END)
                ORDER BY spending DESC LIMIT 3`, (err, results)=>{
                            if(err){
                                throw err;
                            }
                            resolve(results.rows);
                        })
            })

            theMonth = getThisMonth();
            theYear = getThisYear();
            if(methodType == 'get'){
                res.render('generatereport', {user: req.user.full_name, user_role: req.user.user_role, 
                    one: req.reportOne, two: req.reportTwo, three: req.reportThree,
                four: req.reportFour});
            }
            else{
                return next();
            }
            
        }
}

//---------------------------------------------------------------------------------NOTIFICATIONS------------------------------------------------------------------------

schedule.scheduleJob('0 8 2-31 * *', ()=>{
    pool.query(`SELECT * FROM start_month_log  
                WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_month_started) 
                AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_month_started)`, (err, results)=>{
                    if(err){
                        throw err;
                    }
                    if(results.rows.length == 0){
                        pool.query(`SELECT email FROM user_information WHERE user_role = $1`, [userRoles.ADMIN], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            let allEmails = [];
                            for(let iCount=0; iCount<results.rows.length; iCount++){
                                allEmails[iCount] = results.rows[iCount].email;
                            }
                            let options = {
                                from: 'fambudgetly@outlook.com',
                                to: allEmails,
                                subject: "Start Month Reminder!",
                                text: "Please start the month!"
                            }
                            transporter.sendMail( options, function(err, info){
                                if(err){
                                    throw err;
                                }
                                console.log("Sent " + info.response)
                            }

                            )
                        })
                    }else{
                        console.log("Month is already started!");
                    }
                })
})

function sendNotificationMessage(){
    return (req, res)=>{
        let {category} = req.body;
        console.log(category);
        pool.query(`SELECT category.category_id, category.category_name FROM (SELECT budget_data.category_id, budget_data.budget, SUM(spending_data.spending) AS spendings FROM (SELECT * FROM budget_data
            WHERE EXTRACT(YEAR FROM time_created) = EXTRACT(YEAR FROM NOW())
            AND EXTRACT(MONTH FROM time_created) = EXTRACT(MONTH FROM NOW())) budget_data 
            LEFT JOIN 
            (SELECT * FROM spending_data
            WHERE EXTRACT(YEAR FROM spending_date) = EXTRACT(YEAR FROM NOW())
            AND EXTRACT(MONTH FROM spending_date) = EXTRACT(MONTH FROM NOW())) spending_data 
            ON budget_data.category_id = spending_data.category_id
            GROUP BY budget_data.category_id, budget_data.budget
            HAVING SUM(spending_data.spending) > (budget * 0.8)) tablefinal
            LEFT JOIN category ON category.category_id = tablefinal.category_id;`,(err, results)=>{
                if(err){
                    throw err;
                }

                let bool = false

                for(let iCount=0; iCount<results.rows.length; iCount++){
                    if(results.rows[iCount].category_id == category){
                        bool = true;
                    }  
                }
                if(results.rows.length > 0 && bool){
                    let message = "";

                    let bool = false;

                    console.log(bool);
                    
                    for(let iCount=0; iCount<results.rows.length; iCount++){
                        if(iCount != results.rows.length-1){
                            message = message + results.rows[iCount].category_name + ", ";
                        }else{
                            message = message + results.rows[iCount].category_name + "";
                        }   
                    }
                    message = "The spendings has been exceeded by 80% for the catgories: " + message;
                    pool.query(`SELECT email FROM user_information`, (err, results)=>{
                        if(err){
                            throw err;
                        }

                        let allEmails = [];
                        for(let iCount=0; iCount<results.rows.length; iCount++){
                            allEmails[iCount] = results.rows[iCount].email;
                        }

                        let options = {
                            from: 'fambudgetly@outlook.com',
                            to: allEmails,
                            subject: "Budget Exceeded",
                            text: message
                        }
                        transporter.sendMail( options, function(err, info){
                            if(err){
                                throw err;
                            }
                            console.log("Sent " + info.response)
                        })

                    })   
                    console.log(message)
                }
                else{
                    console.log("Not Exceeded");
                }
            })
    }
}
//-------------------------------------------------------------------------------DOWNLOAD CSV---------------------------------------------------------------------------

app.post('/users/generatereport/one', checkNotAuthenticated, checkSuperUser, viewReport('post'), (req, res)=>{
    let jsonscsvParser = new Parser();
    let csv = jsonscsvParser.parse(req.reportOne);
    console.log(csv);
    res.attachment("information.csv");
    res.status(200).send(csv);
})

app.post('/users/generatereport/two', checkNotAuthenticated, checkSuperUser, viewReport('post'), (req, res)=>{
    let jsonscsvParser = new Parser();
    let csv = jsonscsvParser.parse(req.reportTwo);
    console.log(csv);
    res.attachment("information.csv");
    res.status(200).send(csv);
})

app.post('/users/generatereport/three', checkNotAuthenticated, checkSuperUser, viewReport('post'), (req, res)=>{
    let jsonscsvParser = new Parser();
    let csv = jsonscsvParser.parse(req.reportThree);
    console.log(csv);
    res.attachment("information.csv");
    res.status(200).send(csv);
})

app.post('/users/generatereport/four', checkNotAuthenticated, checkSuperUser, viewReport('post'), (req, res)=>{
    let jsonscsvParser = new Parser();
    let csv = jsonscsvParser.parse(req.reportFour);
    console.log(csv);
    res.attachment("information.csv");
    res.status(200).send(csv);
})



//----------------------------------------------------------------------------REGISTERATION AND LOGIN ------------------------------------------------------------------
app.post('/users/register', checkAuthenticated, async (req, res)=>{

    let {name, email, password, password2, telephone, nickname} = req.body;
    // console.log({
    //    name, 
    //    email, 
    //    password, 
    //    password2
    // });

    let errors = [];

    if(!name.trim() || !email.trim() || !password.trim() || !password2.trim()){
        errors.push({message: "Please enter all the fields"});
    }

    if(password.length < 6){
        errors.push({message: "Password should be at least 6 characters!"});
    } else if(password!=password2){
        errors.push({message: "Passwords do not match"});
    }

    if(errors.length > 0){
        res.render("register", {errors});
    }
    else{
        // Form validation passed
        let hashedPassword = await bcrypt.hash(password, 10);
        //console.log(hashedPassword);

        pool.query(
            `SELECT * FROM user_information
            WHERE email = $1`, [email], (err, results)=>{
                
                if(err){
                    throw err;
                }

                //console.log(results.rows);

                if(results.rows.length > 0){
                    errors.push({message: "This email is already registered"});
                    res.render("register", {errors});
                }
                else{
                    pool.query(
                        `INSERT INTO user_information (username, password_hash, user_role, full_name, email, phone_number, nick_name)
                        VALUES($1, $2, $3, $4, $5, $6, $7)
                        RETURNING user_id`, [email, hashedPassword, userRoles.REGULAR, name, email, telephone, nickname], (err, results)=>{
                            if(err){
                                throw err;
                            }
                            console.log(results.rows);
                            req.flash('success_msg', "You are now registered. Please log in!");
                            res.redirect("/users/login");
                        }
                    )
                }
            }
        )

    }
     
    console.log(errors);
});

// LOGIN
app.post("/users/login", checkAuthenticated, passport.authenticate('local', {
    successRedirect: "/users/dashboard",
    failureRedirect: "/users/login",
    failureFlash: true
}));


// AUTHENTICATION FUNCTIONS
function checkAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return res.redirect("/users/dashboard");
    }
    return next();
}

function checkNotAuthenticated(req, res, next){
    if(req.isAuthenticated()){
       return next();
    }
    //return next();
    return res.redirect("/users/login");
}

// User authorization
function checkSuperUser(req, res, next){

    pool.query(`SELECT user_id, user_role FROM user_information WHERE user_id = $1`,[req.user.user_id], (err, results)=>{

        if(err){
            throw err;
        }

        if(results.rows[0].user_role == userRoles.ADMIN){
            return next();
        }else{
            req.flash('error_msg', "YOU ARE NOT AUTHORIZED!");
            return res.redirect("/users/dashboard");
        }
        
    })  
}

// Budget Function
function checkIfMonthStarted(req, res, next){
    pool.query(`SELECT * FROM start_month_log  
                WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_month_started) 
                AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_month_started)`, (err, results)=>{
                    if(err){
                        throw err;
                    }
                    if(results.rows.length>0){
                        req.flash('error_msg', "Month Already Started!");
                        return res.redirect("/users/startmonth");
                    }else{
                        return next();
                    }
                })
}

function checkIfMonthNotStarted(myPath){
    return (req, res, next)=>{
    pool.query(`SELECT * FROM start_month_log  
                WHERE EXTRACT(YEAR FROM NOW()) = EXTRACT (YEAR FROM time_month_started) 
                AND EXTRACT(MONTH FROM NOW()) = EXTRACT (MONTH FROM time_month_started)`, (err, results)=>{
                    if(err){
                        throw err;
                    }
                    if(results.rows.length>0){
                        return next();
                    }else{
                        
                        req.flash('error_msg', "Please start the month to manage the budget!");
                        return res.redirect(myPath);
                    }
                })
}}

// Date function
function getThisMonth(){
        //console.log("Month")
        var dt = new Date();
        dt.setHours(dt.getHours()-8);
        var month = (dt.getUTCMonth() + 1);
        return month; 
}

function getThisYear(){
        //console.log("year")
        var dat = new Date();
        dat.setHours(dat.getHours()-8);
        var year = dat.getFullYear();
        return year;
}

app.listen(PORT, ()=>{
    console.log("Connected");
});