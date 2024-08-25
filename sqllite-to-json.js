const sqlite3 = require("sqlite3").verbose();
const fs = require("fs");

// Open the SQLite database
let db = new sqlite3.Database("crawler.sqlite", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the database.");
  }
});

// Function to export table data to JSON
const exportTableToJSON = (tableName) => {
  db.all(
    `SELECT itemId, comment, rating, order_count as orderCount, totalReview, createdDate FROM ${tableName}`,
    [],
    (err, rows) => {
      if (err) {
        console.error(`Error retrieving data from ${tableName}:`, err.message);
        return;
      }

      // Convert rows to JSON
      const jsonData = JSON.stringify(rows, null, 2);

      // Write JSON data to file
      fs.writeFileSync(`data/${tableName}.json`, jsonData, (err) => {
        if (err) {
          console.error(`Error writing file ${tableName}.json:`, err.message);
        } else {
          console.log(
            `Data from table ${tableName} has been exported to ${tableName}.json`
          );
        }
      });
    }
  );
};

// Function to get all table names from the database
const exportAllTables = () => {
  db.all(
    `SELECT name FROM sqlite_master WHERE type='table'`,
    [],
    (err, tables) => {
      if (err) {
        console.error("Error retrieving table names:", err.message);
        return;
      }

      tables.forEach((table) => {
        exportTableToJSON(table.name);
      });
    }
  );
};

// Export all tables
exportAllTables();

// Close the database connection
db.close((err) => {
  if (err) {
    console.error("Error closing the database:", err.message);
  } else {
    console.log("Database connection closed.");
  }
});
