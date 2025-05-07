// processor.js
let requestCounter = 0;
const MAX_REQUESTS = 10000;

export const beforeScenario = function (context, ee, next) {
  // Inisialisasi data atau variabel yang dibutuhkan
  context.vars.requestId = 0;
  return next();
};

export const beforeRequest = function (requestParams, context, ee, next) {
  // Menambahkan counter untuk melacak jumlah request
  if (requestCounter < MAX_REQUESTS) {
    requestCounter++;
    context.vars.currentRequestNumber = requestCounter;

    // Tambahkan header atau parameter untuk melacak request
    requestParams.headers = requestParams.headers || {};
    requestParams.headers["X-Request-ID"] = `req-${requestCounter}`;

    // Lanjutkan request
    return next();
  } else {
    // Jika sudah mencapai batas 1000 request, batalkan request berikutnya
    return next(new Error("Batas 10000 request tercapai"));
  }
};

export const afterResponse = function (
  requestParams,
  response,
  context,
  ee,
  next
) {
  // Lakukan sesuatu dengan respons jika perlu
  console.log(
    `Request ${context.vars.currentRequestNumber}/${MAX_REQUESTS} completed with status: ${response.statusCode}`
  );

  // Tambahkan logika custom untuk menganalisis respons
  if (response.statusCode >= 400) {
    ee.emit(
      "error",
      new Error(`Request failed with status ${response.statusCode}`)
    );
  }

  return next();
};

export const generateRandomData = function (userContext, events, done) {
  // Contoh: Buat data unik untuk setiap request
  userContext.vars.timestamp = Date.now();
  userContext.vars.randomValue = Math.floor(Math.random() * 1000);

  return done();
};
