const axios = require("axios");
const fs = require("fs");
const { SHOP_LIST } = require("./shopList");
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("crawler.sqlite");

// Define your headers and cookies
const headers = {
  Referer: "https://my.lazada.vn/",
};

var cookies = fs.readFileSync("cookie.txt", "utf-8");

const getRandom = (min, max) => Math.random() * (max - min) + min;
const delay = () => {
  let time = getRandom(5000, 10000);
  return new Promise((resolve) =>
    setTimeout(() => {
      resolve();
    }, time)
  );
};

const countProduct = (shop, itemId, page) => {
  return new Promise((resolve, reject) => {
    let sql = `select count(1) as count from ${shop} where itemId=? and page=?`;
    let params = [itemId, page];

    return db.get(sql, params, function (err, data) {
      if (err) {
        return reject(err.message);
      }

      if (data) {
        return resolve(data.count ?? 0);
      }

      return resolve(0);
    });
  });
};

const insertReviews = (
  shop,
  pageNumber,
  itemId,
  itemSoldCntShow,
  totalReview,
  reviews
) => {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`INSERT INTO ${shop} VALUES (?,?,?,?,?,?,?)`);

    reviews.forEach((item) => {
      const review = {
        itemId: Number(itemId),
        page: Number(pageNumber),
        comment: item.reviewContent,
        rating: Number(item.rating),
        order_count: itemSoldCntShow,
        totalReview: Number(totalReview),
        createdDate: item.reviewTime,
      };

      if (review.comment)
        stmt.run(
          review.itemId,
          review.page,
          review.comment,
          review.rating,
          review.order_count,
          review.totalReview,
          review.createdDate
        );
    });

    stmt.finalize((err) => {
      if (err) return reject(err.message);
      else
        return resolve(`ItemId=${itemId} page=${pageNumber} insert successful`);
    });
  });
};

const crawlData = async (shop) => {
  let pageProduct = 1;
  while (true) {
    await delay();

    const response = await axios.get(`${shop.productList}${pageProduct}`, {
      headers: {
        ...headers,
        Cookie: cookies,
      },
    });

    if (
      response.data &&
      String(response.data).includes("sessionStorage.x5referer")
    ) {
      fs.writeFileSync("captcha.txt", response.data);
      console.log("update captcha...");
      await delay();
      cookies = fs.readFileSync("cookie.txt", "utf-8");
      continue;
    }

    if (!(response && response.data && response.data.mods)) {
      pageProduct++;
      continue;
    }

    const { listItems } = response.data.mods;

    if (listItems && listItems.length > 0) {
      for (let i = 0; i < listItems.length; i++) {
        const itemId = listItems[i].itemId;
        const review = listItems[i].review;

        if (!(review && Number(review) > 0)) {
          console.log(`ItemId=${itemId} has review = 0`);
          continue;
        }

        let pageReview = 1;
        while (true) {
          let count = await countProduct(shop.name, itemId, pageReview);
          if (count > 0) {
            console.log(
              `ItemId=${itemId} page=${pageReview} already existing...`
            );
            pageReview++;
            continue;
          }

          await delay();

          const response = await axios.get(
            `https://my.lazada.vn/pdp/review/getReviewList?itemId=${Number(
              itemId
            )}&pageSize=50&filter=0&sort=0&pageNo=${pageReview}`,
            {
              headers: {
                ...headers,
                Cookie: cookies,
              },
            }
          );

          if (
            response.data &&
            String(response.data).includes("sessionStorage.x5referer")
          ) {
            fs.writeFileSync("captcha.txt", response.data);
            console.log("Need update captcha...");
            await delay();
            cookies = fs.readFileSync("cookie.txt", "utf-8");
            continue;
          }

          const { success, model } = response.data;
          const itemSoldCntShow = listItems[i].itemSoldCntShow;
          const totalReview = listItems[i].review;

          if (success && model) {
            if (model.items && model.items.length > 0) {
              console.log(
                await insertReviews(
                  shop.name,
                  pageReview,
                  itemId,
                  itemSoldCntShow,
                  totalReview,
                  model.items
                )
              );

              if (model.items.length < 50) break;
            }
          } else break;

          pageReview++;
        }
      }

      if (listItems.length < 50) break;
    }

    pageProduct++;
  }
};

SHOP_LIST.filter((x) => !x.processed).forEach(async (item, index) => {
  db.serialize(() => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ${item.name}(
        itemId REAL,
        page REAL,
        comment TEXT,
        rating REAL,
        order_count TEXT,
        totalReview REAL,
        createdDate TEXT
      ) STRICT
    `);
  });
  await crawlData(item);
});
