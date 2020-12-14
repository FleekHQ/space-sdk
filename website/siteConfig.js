/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// See https://docusaurus.io/docs/site-config for all the possible
// site configuration options.

// List of projects/orgs using your project for the users page.
// const users = [
//   {
//     caption: 'User1',
//     // You will need to prepend the image path with your baseUrl
//     // if it is not '/', like: '/test-site/img/image.jpg'.
//     image: '/img/undraw_open_source.svg',
//     infoLink: 'https://www.facebook.com',
//     pinned: true,
//   },
// ];

const siteConfig = {
  title: 'Space SDK Package', // Title for your website.
  tagline: 'A client performin Space Storage actions in the browser.',
  url: 'https://fleekhq.github.io', // Your website URL
  baseUrl: '/space-sdk/', // Base URL for your project */
  // For github.io type URLs, you would set the url and baseUrl like:
  //   url: 'https://facebook.github.io',
  //   baseUrl: '/test-site/',

  // Used for publishing and more
  projectName: '@space/sdk',
  organizationName: 'FleekHQ',
  // For top-level user or org sites, the organization is still the same.
  // e.g., for the https://JoelMarcey.github.io site, it would be set like...
  //   organizationName: 'JoelMarcey'

  // For no header links in the top nav bar -> headerLinks: [],
  headerLinks: [
    { doc: 'sdk.users', label: 'Users' },
    { doc: 'sdk.userstorage', label: 'Storage' },
    { href: 'https://docs.fleek.co/space-daemon/overview/', label: 'Space Docs' },
  ],

  /* path to images for header/footer */
  headerIcon: 'img/space.svg',
  footerIcon: 'img/space.svg',
  favicon: 'img/space.svg',

  /* Colors for website */
  colors: {
    primaryColor: '#2935ff',
    secondaryColor: '#F4BAD3',
  },

  /* Custom fonts for website */
  fonts: {
    mainFont: ['Roboto', 'Arial', 'San-Serif'],
  },

  stylesheets: [
    'http://fonts.googleapis.com/css?family=Roboto:400,100,100italic,300,300italic,400italic,500,500italic,700,700italic,900italic,900',
  ],

  // This copyright info is used in /core/Footer.js and blog RSS/Atom feeds.
  copyright: `Copyright © ${new Date().getFullYear()} FleekHQ`,
  usePrism: ['jsx'],
  highlight: {
    theme: 'atom-one-dark',
  },
  scripts: [
    'https://buttons.github.io/buttons.js',
    'https://cdnjs.cloudflare.com/ajax/libs/clipboard.js/2.0.0/clipboard.min.js',
  ],
  facebookComments: false,
  twitter: 'true',
  twitterUsername: 'spacestorage',
  ogImage: 'img/space.svg',
  twitterImage: 'img/space.svg',
  onPageNav: 'separate',
  cleanUrl: true,
  scrollToTop: false,
  scrollToTopOptions: {
    zIndex: 10,
  },
  enableUpdateTime: true,
  enableUpdateBy: true,
  docsSideNavCollapsible: false,
};

module.exports = siteConfig;
