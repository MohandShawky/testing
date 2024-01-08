const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3");
const axios = require("axios");

const app = express();
const port = 3000;
const apiKey = "sbDMOuA8fhahM1M9c4FUXQ==Cwwljuya8FP8Girs";
const risk_value = 200;
const max_sugar = 70.0;
//commit
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

async function getLogs(userId, logType) {
  return new Promise((resolve, reject) => {
    let query, params;
    switch (logType) {
      case "glucose":
        query = "SELECT * FROM glucose_readings WHERE user_id = ?";
        params = [userId];
        break;
      case "meal":
        query = "SELECT * FROM meals_data WHERE user_id = ?";
        params = [userId];
        break;
      case "activity":
        query = "SELECT * FROM activity WHERE user_id = ?";
        params = [userId];
        break;
      default:
        reject("Invalid log type");
    }

    db.all(query, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

function organizeLogsByMonthAndYear({ glucoseReadings, meal, activityData }) {
  const organizedData = {};

  function getDateKey(date) {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      year: "numeric",
    });
  }

  glucoseReadings.forEach((reading) => {
    const { user_id, id, ...filteredData } = reading;
    const dateKey = getDateKey(reading.date);
    organizedData[dateKey] = organizedData[dateKey] || [];
    organizedData[dateKey].push({ log_type: 0, data: filteredData });
  });

  meal.forEach((meal) => {
    const { user_id, ...filteredData } = meal;
    const dateKey = getDateKey(meal.date);
    organizedData[dateKey] = organizedData[dateKey] || [];
    organizedData[dateKey].push({ log_type: 1, data: filteredData });
  });

  activityData.forEach((activity) => {
    const { user_id, ...filteredData } = activity;
    const dateKey = getDateKey(activity.date);
    organizedData[dateKey] = organizedData[dateKey] || [];
    organizedData[dateKey].push({ log_type: 2, data: filteredData });
  });

  return organizedData;
}

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
      `SELECT * FROM glucose_readings WHERE user_id = ? AND type = ? AND substr(date, 1, 4) = ? AND substr(date, 6, 2) = ?`,
      [
        userId,
        type,
        currentYear.toString(),
        currentMonth.toString().padStart(2, "0"),
      ],
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
async function getGlucoseReadingsInRange(userId, startDate, endDate) {
  const rows = await new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM glucose_readings WHERE user_id = ? AND date BETWEEN ? AND ?`,
      [userId, startDate, endDate],
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
function calcMaxSugar(birthDateYear, weight, height) {
  const userbirthdate = new Date(birthDateYear).getFullYear();
  const currentDate = new Date().getFullYear();
  const age = currentDate - userbirthdate;
  const bmr = 655 + 9.6 * weight + 1.8 * height - 4.7 * age;
  const finalbmr = Math.round((bmr * 0.1) / 4);
  console.log(finalbmr);
  return finalbmr;
}

app.get("/api/users/:userId/glucose_readings", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    const [before, after] = await Promise.all([
      getGlucoseReading(userId, currentYear, currentMonth, "before"),
      getGlucoseReading(userId, currentYear, currentMonth, "after"),
    ]);

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

app.get("/api/users/:userId/risks", async (req, res) => {
  try {
    const userId = req.params.userId;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;

    const readings = await getGlucoseReadingsInRange(
      userId,
      startDate,
      endDate
    );
    const highReadings = readings.filter(
      (reading) => reading.value > risk_value
    );

    const filteredHighReadings = highReadings.map(
      ({ id, user_id, ...rest }) => rest
    );
    const avg = calculateAverage(
      filteredHighReadings.map((reading) => reading.value)
    );
    const result = {
      highReadings: filteredHighReadings,
      avg: avg,
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
          (id, name, birth_date, height, weight, diabetes_type, glucose_level, a1c, insulin, carbs, sugar, is_completed, activity_calories, max_sugar)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      0,
      0,
      calcMaxSugar(birthDate, weight, height),
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

async function addSugar(user_id, date, value) {
  await new Promise((resolve, reject) => {
    db.all(
      "INSERT INTO sugar (user_id, date, value) VALUES (?, ?, ?)",
      [user_id, date, value],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}
async function updateTotalSugarForUser(userId, date, totalSugarToAdd) {
  try {
    const meals = await new Promise((resolve, reject) => {
      db.all(
        "SELECT sugar FROM meals_data WHERE user_id = ? AND date = ?",
        [userId, date],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });

    // const sugarToAdd = meals.reduce((acc, meal) => {
    //   return acc + (meal.sugar || 0);
    // }, 0);

    const existingTotalSugar = await new Promise((resolve, reject) => {
      db.get("SELECT sugar FROM users WHERE id = ?", [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row ? row.sugar : 0);
        }
      });
    });

    const newTotalSugar = totalSugarToAdd + existingTotalSugar;

    if (existingTotalSugar === 0) {
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO users (id, sugar) VALUES (?, ?)",
          [userId, newTotalSugar],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    } else {
      await new Promise((resolve, reject) => {
        console.log(newTotalSugar);
        db.run(
          "UPDATE users SET sugar = ? WHERE id = ?",
          [newTotalSugar, userId],
          (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });
    }

    console.log(`Total sugar updated for user ${userId} on ${date}`);
  } catch (error) {
    console.error("Error updating total sugar:", error);
    throw error;
  }
}

async function addCarbs(user_id, date, value) {
  await new Promise((resolve, reject) => {
    db.all(
      "INSERT INTO carbs (user_id, date, value) VALUES (?, ?, ?)",
      [user_id, date, value],
      (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}
async function insertMealData(user_id, meals) {
  try {
    let totalSugarToAdd = 0;

    for (let i = 0; i < meals.length; i++) {
      const meal = meals[i];
      await new Promise((resolve, reject) => {
        db.run(
          "INSERT INTO meals_data (user_id, name, date, carbs, sugar) VALUES (?, ?, ?, ?, ?)",
          [user_id, meal.name, meal.date, meal.carbs, meal.sugar],
          function (err) {
            if (err) {
              console.error("Error inserting meal:", err);
              reject(err);
            } else {
              console.log("Meal data added with ID:", this.lastID);
              addSugar(user_id, meal.date, meal.sugar);
              addCarbs(user_id, meal.date, meal.carbs);
              totalSugarToAdd += meal.sugar;
              resolve();
            }
          }
        );
      });
    }

    await updateTotalSugarForUser(user_id, meals[0].date, totalSugarToAdd);
    console.log("Total sugar updated for user", user_id);
  } catch (error) {
    console.error("Error inserting meals:", error);
    throw error;
  }
}

app.post("/api/nutrients", async (req, res) => {
  const { user_id, meals } = req.body;
  try {
    await insertMealData(user_id, meals);
    res.status(201).send("Meals added successfully");
  } catch (err) {
    console.error("Error inserting meals:", err);
    res.status(500).send("Internal Server Error");
  }
});

// app.post("/api/nutrients", (req, res) => {
//   const { user_id, date, name, carbs, sugar } = req.body;

//   db.run(
//     "INSERT INTO meals_data (user_id, name, date, carbs, sugar) VALUES (?, ?, ?, ?, ?)",
//     [user_id, name, date, carbs ?? 0, sugar ?? 0],
//     function (err) {
//       if (err) {
//         console.error("Error inserting meal:", err);
//         res.status(500).send("Internal Server Error");
//       } else {
//         console.log("Meal data added with ID:", this.lastID);
//         addSugar(user_id, date, sugar);
//         addCarbs(user_id, date, carbs);
//         res.status(201).send("Meal added successfully");
//       }
//     }
//   );
// });

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

app.post("/api/sugar", (req, res) => {
  const { user_id, date, value } = req.body;

  db.run(
    "INSERT INTO sugar (user_id, date, value) VALUES (?, ?, ?)",
    [user_id, date, value],
    function (err) {
      if (err) {
        console.error("Error inserting carbs:", err);
        res.status(500).send("Internal Server Error");
      } else {
        console.log("carbs added with ID:", this.lastID);
        res.status(201).send("carbs added successfully");
      }
    }
  );
});

app.post("/api/carbs", (req, res) => {
  const { user_id, date, value } = req.body;

  db.run(
    "INSERT INTO carbs (user_id, date, value) VALUES (?, ?, ?)",
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

app.get("/api/users/:userId/sugar", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentDate = new Date().toISOString().split("T")[0];

    const rows = await new Promise((resolve, reject) => {
      db.all(
        "SELECT * FROM sugar WHERE user_id = ? AND date = ?",
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
      res.json({ sugar: rows[0].value });
    } else {
      res.json({ sugar: 0 });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
app.get("/api/users/:userId/carbs/weekly", async (req, res) => {
  try {
    const userId = req.params.userId;
    const currentDate = new Date();
    const currentDayOfWeek = currentDate.getDay();
    const daysUntilSaturday = (currentDayOfWeek + 7 - 6) % 7;
    const daysUntilFriday = (5 - currentDayOfWeek + 7) % 7;
    const weekStartDate = new Date(currentDate);
    weekStartDate.setDate(currentDate.getDate() - daysUntilSaturday);
    const weekEndDate = new Date(currentDate);
    weekEndDate.setDate(currentDate.getDate() + daysUntilFriday);
    const rows = await new Promise((resolve, reject) => {
      db.all(
        `SELECT * FROM carbs WHERE user_id = ? AND date BETWEEN ? AND ? ORDER BY date`,
        [
          userId,
          weekStartDate.toISOString().split("T")[0],
          weekEndDate.toISOString().split("T")[0],
        ],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
    const dayValuesMap = new Map();
    rows.forEach((row) => {
      const rowDate = row.date.split(" ")[0];
      const existingValue = dayValuesMap.get(rowDate) || 0;
      dayValuesMap.set(rowDate, existingValue + row.value);
    });

    const orderedData = Array.from({ length: 7 }, (_, index) => {
      const currentDate = new Date(weekStartDate);
      currentDate.setDate(currentDate.getDate() + index);
      const formattedDate = currentDate.toISOString().split("T")[0];

      return dayValuesMap.get(formattedDate) || 0;
    });
    // console.log(weekStartDate);
    // console.log(weekEndDate);
    // console.log(currentDate);
    const result = {
      data: orderedData,
      avg: calculateAverage(orderedData),
    };

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});

app.get("/api/users/:userId/logs/history", async (req, res) => {
  try {
    const userId = req.params.userId;

    const glucoseReadings = await getLogs(userId, "glucose");
    const meal = await getLogs(userId, "meal");
    const activityData = await getLogs(userId, "activity");

    const organizedData = organizeLogsByMonthAndYear({
      glucoseReadings,
      meal,
      activityData,
    });

    const transformedData = Object.keys(organizedData).map((date) => ({
      date,
      values: organizedData[date],
    }));

    res.json(transformedData);
  } catch (error) {
    console.error(error);
    res.status(500).send("Internal Server Error");
  }
});
