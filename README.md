# FamBudgetly
A web application made for a single family to manage their monthly budget. Fam-Budgetly allows users to start budget every month, manage users, manage spendings, manage categories, manage profile, implement automatic notifications etc.
- Implemented Node.js, Express.js, RESTful API for the backend
- PostgreSQL is used as the database system
- Embedded JavaScript (EJS) is used for the Front-End

All Functions:
1. Registration: 
	Regular users can register themselves using the registration page.

2.	Sign-In/login: 
	Super users and regular users can log into their account with different privileges.

3.	Ability to change personal information: 
	All users can change their personal information like name, password, email etc.

4.	Ability to add, alter or remove Regular Users: 
	Implemented user management system to manage (add, delete, or edit) regular users accounts. This privilege is only available to Super Users.

5.	Start of Month: 
	Every month, the Super User must start the month. If not started, no user can add their spendings in the system until the budget for the month is not started. 

6.  Categories: 
	Super user can add, change, or delete budget categories.

7.	Notification (Start of Month): 
	If month not started, the system would send out a reminder email on the 2nd day of the month to super users. Email will be sent daily until the super user starts the month. 

8.	Spending: 
	All users can add, alter, or delete personal spending data once the month has been started.

9.	Altering/Deleting Spending Data (After Month’s Completion): 
	When new month starts, regular users cannot input, alter, or delete any spending data. Super users are able to add or alter spending data, but they are not able to delete data for previous months.   

10.	Notification Email (Exceeding Budget Warning): 
	When any category's total spending reaches 80% of the budget, the system will send an alert email to all users. 

11.	Generating Reports: 
	The super users are able to generate a monthly report and download a CSV file containing the data.


Total time taken to complete the project: 2 Months.
