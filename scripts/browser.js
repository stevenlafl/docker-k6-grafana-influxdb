import http from 'k6/http';
import { check, sleep, fail } from 'k6';
import { parseHTML } from 'k6/html';

export let options = {
  stages: [
    { duration: '1m', target: 30 },
    { duration: '5m', target: 30 },
    { duration: '5m', target: 0}
  ],
};

const BASE_URL = __ENV.BASE_URL;
const USERNAME = __ENV.USERNAME;
const PASSWORD = __ENV.PASSWORD;
const ADMIN_URLS = [
  '/node/1',
  '/admin/content',
  '/admin/people',
  '/admin/modules',
  '/admin/config',
  '/admin/appearance',
  '/admin/people/permissions',
  '/admin/people/roles',
  '/admin/people/create',
  // ... other admin URLs
  '/user/logout',
];

function extractFormBuildId(body) {
  // Use regex to extract the form_build_id
  let formBuildIdMatch = body.match(/name="form_build_id" value="([^"]+)"/);
  return formBuildIdMatch ? formBuildIdMatch[1] : null;
}

function retryRequest(method, url, body, params = {}) {
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
  // Fetch login page to get CSRF token
  let loginPageRes = retryRequest('GET', `${BASE_URL}/user/login`, null);
  let formBuildId = extractFormBuildId(loginPageRes.body);

  // Check if formBuildId was found
  if (!formBuildId) {
    console.error('Unable to find form_build_id on login page');
    return;
  }

  // Prepare login request
  let loginParams = {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    redirects: 0, // do not follow redirects
  };

  // Login payload
  let loginPayload = {
    name: USERNAME,
    pass: PASSWORD,
    form_id: 'user_login_form',
    form_build_id: formBuildId, // Include the extracted form_build_id
  };

  // Send login POST request
  let loginRes = retryRequest('POST', `${BASE_URL}/user/login`, loginPayload, loginParams);

  // Manually handle the redirect and capture the cookie
  let cookies = loginRes.cookies;
  let sessionCookieName = Object.keys(cookies)[0]; // Replace with actual session cookie name if known
  let sessionCookieValue = cookies[sessionCookieName][0].value;

  // Check if the login was successful by looking for the Set-Cookie header
  if (
    !check(loginRes, {
      'is status 303': (r) => r.status === 303,
    })
  ) {
    fail('status code was ' + loginRes.status + ' *not* 303');
  }

  if (
    !check(loginRes, {
      'cookie is set': (r) => sessionCookieValue !== undefined,
    })
  ) {
    fail('cookie was not set');
  }

  if (!sessionCookieValue) {
    console.error('Login did not set a session cookie.');
    return;
  }

  // Manually follow the redirect with the session cookie
  // Check if the Location header contains a full URL or a path
  let redirectUrl = loginRes.headers.Location;
  if (!redirectUrl.startsWith('http')) {
    // If it's not a full URL, prepend with BASE_URL
    redirectUrl = `${BASE_URL}${redirectUrl}`;
  }

  let homePageRes = retryRequest('GET', redirectUrl, null, {
    headers: {
      Cookie: `${sessionCookieName}=${sessionCookieValue}`,
    },
  });

  if (!check(homePageRes, {
    'arrived at home page': (r) => r.status === 200,
  }))
  {
    fail('status code was *not* 200');
  }

  // Sleep a bit before visiting admin URLs
  sleep(1);

  ADMIN_URLS.forEach((adminPath) => {
    let adminRes = retryRequest('GET', `${BASE_URL}${adminPath}`, null, {
      headers: {
        Cookie: `${sessionCookieName}=${sessionCookieValue}`,
      },
    });
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