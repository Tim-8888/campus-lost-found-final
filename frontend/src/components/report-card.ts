import { mediaUrl } from '../api/client'
import type { ReportPublic } from '../types/api'
import { esc } from '../utils/html'
import { dateOnly, timeAgo } from '../utils/format'
import { icon } from './icons'
import { statusBadge, typeBadge } from './ui'
import { displayCategoryName } from '../utils/reference-label'

export function reportCard(report: ReportPublic, compact = false): string {
  const image = report.images[0]
    ? `<img src="${mediaUrl(report.images[0].url)}" alt="${esc(displayCategoryName(report.category.name))} report image" loading="lazy">`
    : `<div class="report-placeholder ${report.report_type === 'LOST' ? 'placeholder-lost' : 'placeholder-found'}">${icon('image', 'placeholder-icon')}<span>No image added</span></div>`
  return `<article class="report-card ${compact ? 'report-card-compact' : ''}">
    <a class="report-card-media" href="#/reports/${report.id}" aria-label="View ${esc(displayCategoryName(report.category.name))} report">${image}<div class="report-card-badges">${typeBadge(report.report_type)}${statusBadge(report.status)}</div></a>
    <div class="report-card-body">
      <div class="report-card-meta"><span>${icon('calendar')} ${dateOnly(report.item_date)}</span><span>${timeAgo(report.created_at)}</span></div>
      <h3><a href="#/reports/${report.id}">${esc(displayCategoryName(report.category.name))}</a></h3>
      <p>${esc(report.description.length > 135 ? `${report.description.slice(0, 135)}…` : report.description)}</p>
      <div class="report-card-details"><span>${icon('location')} ${esc(report.location.name)}</span><span class="colour-dot" aria-hidden="true"></span><span>${esc(report.colour)}</span></div>
    </div>
    <div class="report-card-footer"><a href="#/reports/${report.id}">View details ${icon('arrow')}</a></div>
  </article>`
}
