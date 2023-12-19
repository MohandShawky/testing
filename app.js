const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
const port = 3000;
const apiKey = "sbDMOuA8fhahM1M9c4FUXQ==Cwwljuya8FP8Girs";

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
function calculateAverage(numbers) {
  if (numbers.length === 0) return 0;

  const sum = numbers.reduce((acc, num) => acc + num, 0);
  return sum / numbers.length;
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
    const beforeValues = before.map((reading) => reading.value);
    const afterValues = after.map((reading) => reading.value);

    const allReadings = [...beforeValues, ...afterValues];
    const avg = calculateAverage(allReadings);

    const result = {
      readingsBefore: before,
      readingsAfter: after,
      maxGlucoseValue: await getMaxGlucoseValue(userId),
      avg: Math.round(avg),
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
          (id, name, birth_date, height, weight, diabetes_type, glucose_level, a1c, insulin, carbs, sugar, is_completed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      0,
      0,
      1,
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

app.put("/api/update_user/:userId", (req, res) => {
  const userId = req.params.userId;
  const {
    height,
    weight,
    insulin,
    glucoseLevel,
    a1c,
    birthDate,
    diabetesType,
  } = req.body;

  db.run(
    `UPDATE users 
     SET birth_date = ?,
         height = ?,
         weight = ?,
         diabetes_type = ?,
         glucose_level = ?,
         a1c = ?,
         insulin = ?,
         is_completed = 0
     WHERE id = ?`,
    [
      birthDate,
      height,
      weight,
      diabetesType,
      glucoseLevel,
      a1c,
      insulin,
      userId,
    ],
    function (err) {
      if (err) {
        console.error("Error updating user:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("User data updated for ID:", userId);
        res.status(200).send("User data updated successfully");
      }
    }
  );
});

app.put("/api/update_user_value/:userId", (req, res) => {
  const userId = req.params.userId;
  const { key, value } = req.body;

  db.run(
    `UPDATE users 
     SET ${key} = ?
     WHERE id = ?`,
    [value, userId],
    function (err) {
      if (err) {
        console.error("Error updating user:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("User data updated for ID:", userId);
        res.status(200).send("User data updated successfully");
      }
    }
  );
});

app.get("/api/is_completed/:userId", (req, res) => {
  const userId = req.params.userId;

  db.get(
    `SELECT is_completed FROM users WHERE id = ?`,
    [userId],
    function (err, row) {
      if (err) {
        console.error("Error fetching is_completed:", err);
        res.status(500).send("Internal Server Error");
      } else {
        if (row) {
          res.status(200).json({ is_completed: row.is_completed === 1 });
        } else {
          res.status(404).send("User not found");
        }
      }
    }
  );
});

//##### MEALS API(axios) #####
app.get("/api/meals/search/:query", async (req, res) => {
  const query = req.params.query;
  await axios
    .get("https://api.calorieninjas.com/v1/nutrition", {
      params: {
        query: query,
      },
      headers: {
        "X-Api-Key": apiKey,
      },
    })

    .then((response) => {
      const simplifiedResult = response.data.items.map((item) => ({
        sugar: item.sugar_g,
        calories: item.calories,
        name: item.name,
        servingSize: item.serving_size_g,
        carbs: item.carbohydrates_total_g,
      }));
      res.json(simplifiedResult);
    })
    .catch((error) => {
      if (error.response) {
        console.error("Error:", error.response.status, error.response.data);
      } else if (error.request) {
        console.error("Request failed:", error.request);
      } else {
        console.error("Error:", error.message);
      }
    });
});
//##############################

app.post("/api/nutrients", (req, res) => {
  const { user_id, date, name, carbs, sugar } = req.body;

  db.run(
    "INSERT INTO meals_data (user_id, name, date, carbs, sugar) VALUES (?, ?, ?, ?, ?)",
    [user_id, name, date, carbs ?? 0, sugar ?? 0],
    function (err) {
      if (err) {
        console.error("Error inserting meal:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("Meal data added with ID:", this.lastID);
        res.status(201).send("Meal added successfully");
      }
    }
  );
});

app.get("/api/users/:userId/nutrients", async (req, res) => {
  try {
    const userId = req.params.userId;
    const rows = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM meals_data WHERE user_id = ?",
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.post("/api/activity", (req, res) => {
  const { user_id, value, date, duration } = req.body;

  db.run(
    "INSERT INTO activity (user_id, value, date, duration) VALUES (?, ?, ?, ?)",
    [user_id, value, date, duration],
    function (err) {
      if (err) {
        console.error("Error inserting data into activity table:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("Data added to activity table with ID:", this.lastID);
        res.status(201).send("Data added successfully");
      }
    }
  );
});

app.get("/api/activity/:userId", async (req, res) => {
  try {
    const userId = req.params.userId;

    const rows = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM activity WHERE user_id = ?",
        [userId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });

    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
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
    const currentDate = new Date().toISOString().split("T")[0];

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
