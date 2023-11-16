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
    
}
});

// Define your API routes and logic here
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});



function getMaxGlucoseDateBefore(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings_before WHERE user_id = ? ORDER BY date DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].date : null);
    }
  });
}
function getMaxGlucoseDateAfter(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings_after WHERE user_id = ? ORDER BY date DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].date : null);
    }
  });
}

function getMaxGlucoseValueBefore(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings_before WHERE user_id = ? ORDER BY value DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].value : null);
    }
  });
}
function getMaxGlucoseValueAfter(userId, callback) {
  // Assuming user_id is the foreign key column in the glucose_readings table
  db.all('SELECT * FROM glucose_readings_after WHERE user_id = ? ORDER BY value DESC LIMIT 1', [userId], (err, rows) => {
    if (err) {
      console.error(err);
      callback(null);
    } else {
      callback(rows.length > 0 ? rows[0].value : null);
    }
  });
}







app.post('/api/glucose_readings_before', (req, res) => {
  const { user_id, date , value } = req.body;

  db.run('INSERT INTO glucose_readings_before (user_id,date,value) VALUES (?, ?, ?)',
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

app.post('/api/glucose_readings_after', (req, res) => {
  const { user_id, date , value } = req.body;

  db.run('INSERT INTO glucose_readings_after (user_id,date,value) VALUES (?, ?, ?)',
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





app.get('/api/users/:userId/glucose_readings_before', (req, res) => {
  const userId = req.params.userId;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Assuming user_id is the foreign key column in the glucose_readings table
  //only current month data
  //WHERE date LIKE 2023-11_
  db.all(`SELECT * FROM glucose_readings_before WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`, [userId, currentYear.toString(),currentMonth.toString()], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Use callbacks to handle asynchronous results
      getMaxGlucoseValueBefore(userId, (maxValue) => {
        getMaxGlucoseDateBefore(userId, (maxDate) => {
          const result = {
            readings: rows,
            maxGlucoseValueBefore: maxValue,
            maxGlucoseDateBefore: maxDate
          };
          res.json(result);
        });
      });
    }
  });
});


app.get('/api/users/:userId/glucose_readings_after', (req, res) => {
  const userId = req.params.userId;
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  // Assuming user_id is the foreign key column in the glucose_readings table
  //only current month data
  //WHERE date LIKE 2023-11_
  db.all(`SELECT * FROM glucose_readings_after WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`, [userId, currentYear.toString(),currentMonth.toString()], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send('Internal Server Error');
    } else {
      // Use callbacks to handle asynchronous results
      getMaxGlucoseValueAfter(userId, (maxValue) => {
        getMaxGlucoseDateAfter(userId, (maxDate) => {
          const result = {
            readings: rows,
            maxGlucoseValueAfter: maxValue,
            maxGlucoseDateAfter: maxDate
          };
          res.json(result);
        });
      });
    }
  });
});












