import moment = require('moment')
import * as url from 'url'
import * as path from 'path'
import {GitHubClient} from '../github'
import {CrawlingTarget} from '../interfaces'
import {IssueList, ProjectIssue} from '../project-reports-lib'

const now = moment()

const reportType = 'project'
export {reportType}

/**
 * Creates labels on referenced issues with a specified label
 */
export function getDefaultConfiguration(): any {
  return <any>{
    'process-with-label': 'feature',
    'column-label-prefix': '> ',
    'linked-label-prefix': '>> ',
    'label-color': 'FFFFFF',
    'skip-columns': ['Done', 'Complete'],
    // need to actually set to true, otherwise it's just a preview of what it would write
    'write-labels': false
  }
}

const noiseWords = ['the', 'in', 'and', 'of', '&']

// needs to be less than 50 chars, so we filter down to words, no noise words and then start removing words at end
function cleanLabelName(prefix: string, title: string) {
  title = title.replace(/\([^()]*\)/g, '').replace(/ *\[[^\]]*]/, '')

  let words = title.match(/[a-zA-Z0-9&]+/g)
  words = words.filter(word => noiseWords.indexOf(word.toLowerCase()) < 0)

  let label = `${prefix.trim()} Invalid`
  while (words.length > 0) {
    label = `${prefix.trim()} ${words.join(' ')}`
    if (label.length <= 50) {
      break
    } else {
      words.pop()
    }
  }

  return label
}

// ensures that only a label with this prefix exists
async function ensureOnlyLabel(
  github: GitHubClient,
  issue: ProjectIssue,
  labelName: string,
  prefix: string,
  config: any
) {
  const write: boolean = config['write-labels']
  if (!write) {
    console.log('Preview mode only')
  }

  const initLabels = issue.labels.filter(label => label.name.trim().toLowerCase() === labelName.trim().toLowerCase())
  if (initLabels.length === 0) {
    // add, but first ...
    // remove any other labels with that prefix
    for (const label of issue.labels) {
      if (label.name.trim().startsWith(prefix) && label.name.trim().toLowerCase() !== labelName.trim().toLowerCase()) {
        console.log(`Label to potentially be removed: ${label.name}`)
        addToBeDeleted(issue.html_url, label.name)
      }
    }

    console.log(`Adding label: ${labelName}`)
    ensureNotToBeDeleted(issue.html_url, labelName)
    if (write) {
      await github.ensureIssueHasLabel(issue.html_url, labelName, config['label-color'])
    }
  } else {
    console.log(`Label already exists: ${labelName}`)
    ensureNotToBeDeleted(issue.html_url, labelName)
  }
}

// get alphanumeric clean version of string (strip special chars). spaces to chars.  remove common filler words (a, the, &, and)
export async function process(
  target: CrawlingTarget,
  config: any,
  data: IssueList,
  github: GitHubClient
): Promise<void> {
  for (const issue of data.getItems()) {
    console.log()
    if (issue.project_column && config['skip-columns'] && config['skip-columns'].indexOf(issue.project_column) >= 0) {
      console.log(`Skipping issue in column ${issue.project_column}`)
      console.log()
      continue
    }

    console.log(`initiative : ${issue.project_column}`)
    console.log(`epic       : ${issue.title}`)

    console.log('creates    :')
    let initLabel
    if (issue.project_column) {
      initLabel = cleanLabelName(config['column-label-prefix'], issue.project_column)
      console.log(`  initiative label : '${initLabel}'`)
    }

    const epicLabel = cleanLabelName(config['linked-label-prefix'], issue.title)
    console.log(`  epic label       : '${epicLabel}'`)

    console.log(issue.body)
    console.log()

    // get issues that have a checkbox in front of it
    let urls = issue.body?.match(/(?<=-\s*\[.*?\].*?)(https?:\/{2}(?:[/-\w.]|(?:%[\da-fA-F]{2}))+)/g)
    
    // in github local refs are possible in an issue such as #123 wil link to issues 123 in the same repo as the current issue.
    // get the current issue url and use it for the url to get issues for refs.
    const localRefs = issue.body?.match(/(?<=-\s*\[.*?\].*?)(?<=#)([0-9]+)/g)
    const repoIssuesUrl = path.dirname(issue.html_url)
    // add refs + local url ref to urls
    localRefs.forEach(function (localRef) {
      const url = path.join(repoIssuesUrl, localRef)
      console.log(`Building url for local ref ${localRef} for repo ${repoIssuesUrl}`)
      urls.push(url);
    });

    for (const match of urls || []) {
      try {
        console.log(`match: ${match}`)
        const u = new url.URL(match)
        const issue = await github.getIssue(match)

        const processLabel = issue.labels.filter(
          label => label.name.toLowerCase() === config['process-with-label'].toLowerCase()
        )

        if (processLabel.length == 0) {
          console.log(`Skipping.  Only processing with label ${config['process-with-label']}`)
          console.log()
          continue
        }

        await ensureOnlyLabel(github, issue, initLabel, config['column-label-prefix'], config)
        await ensureOnlyLabel(github, issue, epicLabel, config['linked-label-prefix'], config)
      } catch (err) {
        console.log(`Ignoring invalid issue url: ${match}`)
        console.log(`(${err.message})`)
      }
      console.log()
    }
  }

  console.log('Cleaning up labels')
  console.log(JSON.stringify(toDelete, null, 2))
  for (const issueUrl in toDelete) {
    console.log(`Cleaning up labels for ${issueUrl}`)
    for (const label of toDelete[issueUrl]) {
      console.log(`Removing label: ${label}`)
      if (config['write-labels']) {
        await github.removeIssueLabel(issueUrl, label)
      }
    }
  }
}

const toDelete: {[name: string]: string[]} = {}
function addToBeDeleted(url: string, label: string) {
  if (!toDelete[url]) {
    toDelete[url] = []
  }

  if (toDelete[url].indexOf(label) == -1) {
    toDelete[url].push(label)
  }
}

function ensureNotToBeDeleted(url: string, label: string) {
  if (toDelete[url]) {
    const idx = toDelete[url].indexOf(label)
    if (idx >= 0) {
      console.log(`Removing from toDelete: ${label} from issue: ${url}`)
      toDelete[url].splice(idx, 1)
    }
  }
}
