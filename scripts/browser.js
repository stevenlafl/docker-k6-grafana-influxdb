import { browser, check } from 'k6/experimental/browser';
import { sleep, fail } from 'k6';

export let options = {
  scenarios: {
    ui: {
      executor: 'shared-iterations',
      vus: 30,
      iterations: 23430,
      maxDuration: '10m',
      options: {
        browser: {
          type: 'chromium',
        },
      },
    },
  },
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

export default async function () {
  const browserContext = browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  });
  browserContext.setDefaultTimeout(1000);
  const page = browserContext.newPage();

  try {
    // Navigate to the login page
    let result = await page.goto(`${BASE_URL}/user/login`);

    //console.log(result.status());

    console.log("reached login page");

    // Fill in the login form
    page.fill('input[name="name"]', USERNAME);
    page.fill('input[name="pass"]', PASSWORD);

    //page.screenshot({ path: '/scripts/01_screenshot.png' });

    // Submit the login form and wait for navigation
    await Promise.all([
      page.waitForNavigation('domcontentloaded'),
      page.click('input[id="edit-submit"]'),
    ]);

    //page.screenshot({ path: '/scripts/02_screenshot.png' });

    console.log("clicked submit login");

    // Check if the login was successful
    if (
      !check(page.url().includes('/user/'), {
        'is status 200': (r) => r.status === 200,
      })
    ) {
      console.error('Login failed, unable to find user page in URL.');
      fail('Login failed');
    }

    console.log("at /user/");

    // Visit the admin URLs
    for (const adminPath of ADMIN_URLS) {
      await page.goto(`${BASE_URL}${adminPath}`);
      //page.screenshot({ path: '/scripts/03_'+adminPath.replace(/\//g,'')+'_screenshot.png' });

      console.log(`at ${adminPath}`);
      // let response = await page.waitForNavigation('domcontentloaded'); // Wait for the network to be idle
      // const status = response.status(); // Get the HTTP status code of the navigation
      
      // if (status !== 200) {
      //   fail(`Expected HTTP 200 for ${adminPath}, got ${status}`);
      // }

      // Sleep some time between admin page visits
      sleep(1);
    }
  } finally {
    // Close the page and browser context
    await page.close();
    await browserContext.close();
  }
}