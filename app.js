const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");

const app = express();
const port = 3000;

app.use(bodyParser.json());

const db = new sqlite3.Database("sugarcare_app.db", (err) => {
  if (err) {
    console.error("Error connecting to SQLite database:", err);
  } else {
    console.log("Connected to SQLite database");
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

async function getMaxGlucoseValue(userId) {
  const before = await _getMaxGlucoseValue(userId, "before");
  const after = await _getMaxGlucoseValue(userId, "after");

  if (before == null && after == null) {
    return 100;
  }
  if (before > after) {
    return before;
  }
  return after;
}

async function _getMaxGlucoseValue(userId, type) {
  return new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM glucose_readings WHERE user_id = ? AND type = ? ORDER BY value DESC LIMIT 1",
      [userId, type],
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

app.post("/api/glucose_readings", (req, res) => {
  const { user_id, date, value, type } = req.body;

  db.run(
    "INSERT INTO glucose_readings (user_id,date,value,type) VALUES (?, ?, ?,?)",
    [user_id, date, value, type],
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

async function getGlucoseReading(userId, currentYear, currentMonth, type) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM glucose_readings WHERE user_id = ? AND type = ? AND strftime('%Y', date) = ? AND strftime('%m', date) = ?`,
      [userId, type, currentYear.toString(), currentMonth.toString()],
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

    const before = await getGlucoseReading(
      userId,
      currentYear,
      currentMonth,
      "before"
    );
    const after = await getGlucoseReading(
      userId,
      currentYear,
      currentMonth,
      "after"
    );
    console.log(before);

    const result = {
      readingsBefore: before,
      readingsAfter: after,
      maxGlucoseValue: await getMaxGlucoseValue(userId),
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

app.post("/api/sugar_intake", (req, res) => {
  const { user_id, date, value } = req.body;

  db.run(
    "INSERT INTO sugar_intake (user_id, date, value) VALUES (?, ?, ?)",
    [user_id, date, value],
    function (err) {
      if (err) {
        console.error("Error inserting sugar intake:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("Sugar intake added with ID:", this.lastID);
        res.status(201).send("Sugar intake added successfully");
      }
    }
  );
});

app.get("/api/users/:userId/sugar_intake", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentDate = new Date().toISOString().split("T")[0]; // Get current date in YYYY-MM-DD format

    const rows = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM sugar_intake WHERE user_id = ? AND date = ?",
        [userId, currentDate],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    if (rows.length > 0) {
      res.json({ sugarIntake: rows[0].value });
    } else {
      res.json({ sugarIntake: 0 });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
