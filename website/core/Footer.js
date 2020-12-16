/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const React = require('react');

class Footer extends React.Component {
  docUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    const docsUrl = this.props.config.docsUrl;
    const docsPart = `${docsUrl ? `${docsUrl}/` : ''}`;
    const langPart = `${language ? `${language}/` : ''}`;
    return `${baseUrl}${docsPart}${langPart}${doc}`;
  }

  pageUrl(doc, language) {
    const baseUrl = this.props.config.baseUrl;
    return baseUrl + (language ? `${language}/` : '') + doc;
  }

  render() {
    return (
      <footer className="nav-footer" id="footer">
        <section className="sitemap">
          <a href={this.props.config.baseUrl} className="nav-home">
            {this.props.config.footerIcon && (
              <img
                src={this.props.config.baseUrl + this.props.config.footerIcon}
                alt={this.props.config.title}
                width="66"
                height="58"
              />
            )}
          </a>
          <div>
            <h5>Docs</h5>
            <a href={this.docUrl('index')}>
              Getting Started
            </a>
            <a href={this.docUrl('hub.client')}>
              ThreadDB
            </a>
            <a href={this.docUrl('hub.buckets')}>
              Buckets
            </a>
          </div>
          <div>
            <h5>Resources</h5>
            <a
              href="https://docs.textile.io/"
              target="_blank"
              rel="noreferrer noopener">
              All Documentation
            </a>
            <a
              href="https://slack.textile.io/"
              target="_blank"
              rel="noreferrer noopener">
              Project Slack
            </a>
            <a
              href="https://blog.textile.io/"
              target="_blank"
              rel="noreferrer noopener">
              Blog
            </a>
          </div>
          <div>
            <h5>More</h5>
            <a href="https://github.com/textileio">GitHub</a>
            <a
              className="github-button"
              href={this.props.config.repoUrl}
              data-icon="octicon-star"
              data-count-href="/textileio/js-threads/stargazers"
              data-show-count="true"
              data-count-aria-label="# stargazers on GitHub"
              aria-label="Star this project on GitHub">
              Star
            </a>
            {this.props.config.twitterUsername && (
              <div className="social">
                <a
                  href={`https://twitter.com/${this.props.config.twitterUsername}`}
                  className="twitter-follow-button">
                  Follow @{this.props.config.twitterUsername}
                </a>
              </div>
            )}
          </div>
        </section>
      </footer>
    );
  }
}

module.exports = Footer;
