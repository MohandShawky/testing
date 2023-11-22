const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");

const app = express();
const port = 3000;

app.use(bodyParser.json());

// SQLite Connection
const db = new sqlite3.Database("sugarcare_app.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err);
  } else {
    console.log("Connected to SQLite database");
  }
});

// Define your API routes and logic here
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

function getMaxGlucoseDateBefore(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM glucose_readings_before WHERE user_id = ? ORDER BY date DESC LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(rows.length > 0 ? rows[0].date : null);
        }
      }
    );
  });
}

function getMaxGlucoseDateAfter(userId, callback) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM glucose_readings_after WHERE user_id = ? ORDER BY date DESC LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(rows.length > 0 ? rows[0].date : null);
        }
      }
    );
  });
}

async function getMaxGlucoseValue(userId) {
  const before = await getMaxGlucoseValueBefore(userId);
  const after = await getMaxGlucoseValueAfter(userId);

  if (before == null && after == null) {
    return 100;
  }
  if (before > after) {
    return before;
  }
  return after;
}

async function getMaxGlucoseValueBefore(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM glucose_readings_before WHERE user_id = ? ORDER BY value DESC LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(rows.length > 0 ? rows[0].value : null);
        }
      }
    );
  });
}

async function getMaxGlucoseValueAfter(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM glucose_readings_after WHERE user_id = ? ORDER BY value DESC LIMIT 1",
      [userId],
      (err, rows) => {
        if (err) {
          console.error(err);
          reject(err);
        } else {
          resolve(rows.length > 0 ? rows[0].value : null);
        }
      }
    );
  });
}

app.post("/api/glucose_readings_before", (req, res) => {
  const { user_id, date, value } = req.body;

  db.run(
    "INSERT INTO glucose_readings_before (user_id,date,value) VALUES (?, ?, ?)",
    [user_id, date, value],
    function (err) {
      if (err) {
        console.error("Error inserting glucose reading:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("Glucose reading added with ID:", this.lastID);
        res.status(201).send("Glucose reading added successfully");
      }
    }
  );
});

app.post("/api/glucose_readings_after", (req, res) => {
  const { user_id, date, value } = req.body;

  db.run(
    "INSERT INTO glucose_readings_after (user_id,date,value) VALUES (?, ?, ?)",
    [user_id, date, value],
    function (err) {
      if (err) {
        console.error("Error inserting glucose reading:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("Glucose reading added with ID:", this.lastID);
        res.status(201).send("Glucose reading added successfully");
      }
    }
  );
  db.run("UPDATE users SET glucose_level = ? WHERE id = ?", [value, user_id]);
});

app.get("/api/users/:id", (req, res) => {
  const userId = req.params.id;
  db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => {
    if (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    } else {
      if (row) {
        res.json(row);
      } else {
        res.status(404).send("User not found");
      }
    }
  });
});

async function getGlucoseReadingBefore(userId, currentYear, currentMonth) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM glucose_readings_before WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
      [userId, currentYear.toString(), currentMonth.toString()],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
  return rows;
}

async function getGlucoseReadingAfter(userId, currentYear, currentMonth) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM glucose_readings_after WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
      [userId, currentYear.toString(), currentMonth.toString()],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
  return rows;
}
app.get("/api/users/:userId/glucose_readings", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const before = await getGlucoseReadingBefore(
      userId,
      currentYear,
      currentMonth
    );
    const after = await getGlucoseReadingAfter(
      userId,
      currentYear,
      currentMonth
    );
    console.log(before);

    // const rows = await new Promise((resolve, reject) => {
    //   db.all(
    //     `SELECT * FROM glucose_readings_before WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
    //     [userId, currentYear.toString(), currentMonth.toString()],
    //     (err, rows) => {
    //       if (err) {
    //         reject(err);
    //       } else {
    //         resolve(rows);
    //       }
    //     }
    //   );
    // });

    const result = {
      readingsBefore: before,
      readingsAfter: after,
      maxGlucoseValue: await getMaxGlucoseValue(userId),
      maxGlucoseDate: await getMaxGlucoseDateBefore(userId),
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/users/:userId/glucose_readings_after", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM glucose_readings_after WHERE user_id = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
        [userId, currentYear.toString(), currentMonth.toString()],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    const result = {
      readingsAfter: rows,
      maxGlucoseValue: await getMaxGlucoseValue(userId),
      maxGlucoseDate: await getMaxGlucoseDateAfter(userId),
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/add_user", (req, res) => {
  const {
    userId,
    name,
    height,
    weight,
    insulin,
    glucoseLevel,
    a1c,
    birthDate,
    diabetesType,
  } = req.body;

  db.run(
    `INSERT INTO users 
          (id, name, birth_date, height, weight, diabetes_type, glucose_level, a1c, insulin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      name,
      birthDate,
      height,
      weight,
      diabetesType,
      glucoseLevel,
      a1c,
      insulin,
    ],
    function (err) {
      if (err) {
        console.error("Error inserting user:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("User reading added with ID:", this.lastID);
        res.status(201).send("User added successfully");
      }
    }
  );
});
