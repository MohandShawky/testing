const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3');

const app = express();
const port = 3000;



app.use(bodyParser.json());

// SQLite Connection
const db = new sqlite3.Database('sugarcare_app.db', (err) => {
  if (err) {
    console.error('Error connecting to SQLite database:', err);
  } else {
    console.log('Connected to SQLite database');
    
    // Create users table (if not exists)



}
});

// Define your API routes and logic here

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



function getMaxGlucoseDate(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings WHERE user_id = ? ORDER BY date DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].date : null);
    }
  });
}

function getMaxGlucoseValue(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings WHERE user_id = ? ORDER BY value DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].value : null);
    }
  });
}



function getGlucoseValueBeforeMeal() {
  
}


function getGlucoseValueAfterMeal() {
  
}

function addGlucoseValue() {

}

app.post('/api/glucose_readings', (req, res) => {
  const { user_id, date , value } = req.body;



  db.run('INSERT INTO glucose_readings (user_id,date,value) VALUES (?, ?, ?)',
    [user_id,date, value ],
    function (err) {
      if (err) {
        console.error('Error inserting glucose reading:', err);
        res.status(500).send('Internal Server Error');
      } else {
        console.log('Glucose reading added with ID:', this.lastID);
        res.status(201).send('Glucose reading added successfully');
      }
    });
});


//get user (spicifed id)
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  db.get('SELECT * FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      if (row) {
        res.json(row);
      } else {
        res.status(404).send('User not found');
      }
    }
  });
});





app.get('/api/users/:userId/glucose_readings', (req, res) => {
  const userId = req.params.userId;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Assuming user_id is the foreign key column in the glucose_readings table
  //only current month data
  //WHERE date LIKE 2023-11_
  db.all(`SELECT * FROM glucose_readings WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`, [userId, currentYear.toString(),currentMonth.toString()], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Use callbacks to handle asynchronous results
      getMaxGlucoseValue(userId, (maxValue) => {
        getMaxGlucoseDate(userId, (maxDate) => {
          const result = {
            readings: rows,
            maxGlucoseValue: maxValue,
            maxGlucoseDate: maxDate
          };
          res.json(result);
        });
      });
    }
  });
});












