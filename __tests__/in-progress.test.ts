import {IssueList, ProjectIssue} from '../project-reports-lib'
import * as inProgress from '../reports/project-in-progress'
import {IssueCardEx, ProgressData} from '../reports/project-in-progress'
import projectData from './project-data.test.json'

const config: any = {
  'report-on': 'Epic',
  // TODO: implement getting a shapshot of data n days ago
  daysAgo: 7,
  'status-label-match': '(?<=status:).*',
  'wip-label-match': '(\\d+)-dev',
  'last-updated-days-flag': 3.0,
  'last-updated-scheme': 'LastCommentPattern',
  'last-updated-scheme-data': '^(#){1,4} [Uu]pdate',
  'status-day': 'Wednesday',
  'previous-days-ago': 7,
  'previous-hour-utc': 17,
  'target-date-comment-field': 'target date'
}

describe('project-in-progress', () => {
  // make sure the mocked data set is loaded and valid
  it('imports a valid projectData from file', async () => {
    expect(projectData).toBeDefined()
    expect(projectData.length).toBe(14)
  })

  it('process returns InProgressData', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = inProgress.process(config, list, drillIn) as ProgressData
    //console.log(JSON.stringify(processed, null, 2));

    expect(processed).toBeDefined()
    expect(processed.cardType).toBe('Epic')

    const cards: IssueCardEx[] = processed.cards as IssueCardEx[]
    expect(cards.length).toBe(4)

    // spot check a card
    expect(cards[0]).toBeDefined()
    expect(cards[0].title).toBe('gRPC generation')
    expect(cards[0].flagHoursLastUpdated).toBeTruthy()
    expect(cards[0].inProgressSince).toContain('ago')
    expect(cards[0].hoursInProgress).toBeGreaterThan(120)

    expect(cards[1]).toBeDefined()
    expect(cards[1].title).toBe('Initial Web UI')
    expect(cards[0].flagHoursLastUpdated).toBeTruthy()
    expect(cards[0].inProgressSince).toContain('ago')
    expect(cards[1].hoursInProgress).toBeGreaterThan(160)
  })

  it('renderMarkdown renders valid markdown', async () => {
    const drillIns = []
    const drillIn = (identifier: string, title: string, cards: ProjectIssue[]) => {
      drillIns.push(identifier)
    }

    const list: IssueList = new IssueList(issue => issue.html_url)
    list.add(projectData)
    const processed = inProgress.process(config, list, drillIn) as IssueCardEx[]
    expect(processed).toBeDefined()

    const markdown = inProgress.renderMarkdown([], processed)
    expect(markdown).toBeDefined()
    // console.log(markdown);
    expect(markdown).toContain('## :hourglass_flowing_sand: In Progress Epics')
    expect(markdown).toContain(
      '| [gRPC generation](https://github.com/bryanmacfarlane/quotes-feed/issues/16)  | :exclamation: | :exclamation: |  :triangular_flag_on_post:'
    )
    expect(markdown).toContain(
      '| [Initial Frontend](https://github.com/bryanmacfarlane/quotes-feed/issues/14) | :green_heart: | :green_heart:'
    )
  })
})
