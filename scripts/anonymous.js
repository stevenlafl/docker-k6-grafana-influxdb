import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { parseHTML } from 'k6/html';

export let options = {
  stages: [
    { duration: '1m', target: 300 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 0}
  ],
};

const BASE_URL = __ENV.BASE_URL;
const USERNAME = __ENV.USERNAME;
const PASSWORD = __ENV.PASSWORD;
const ADMIN_URLS = [
  '/',
  '/node/1',
  '/user/login',
  // ... other admin URLs
  '/user/logout',
];

function retryRequest(method, url, body = null, params = {}) {
  let retries = 5, delay = 0;
  params.timeout = 20000;

  for (let i = 0; i < retries; i++) {
    let response;
    if (method === 'GET') {
      response = http.get(url, params);
    } else if (method === 'POST') {
      response = http.post(url, body, params);
    } else {
      throw new Error('Unsupported HTTP method');
    }

    if (response.status !== 0) {
      return response; // Success, return the response
    }

    // Log the retry info
    console.log(`Request to ${url} failed with status ${response.status}. Retry attempt #${i + 1}`);

    // If not the last attempt, sleep before retrying
    if (i < retries - 1) {
      sleep(delay);
    }
  }
  fail(`Request to ${url} failed after ${retries} retries`);
}

export default function () {

  ADMIN_URLS.forEach((adminPath) => {
    let adminRes = retryRequest('GET', `${BASE_URL}${adminPath}`);
    if (!
      check(adminRes, {
        [`visited ${adminPath}`]: (resp) => resp.status === 200,
      })
    ) {
      fail(adminPath + ' status code was *not* 200');
    }
    // Sleep some time between admin page visits
    sleep(1);
  });

}