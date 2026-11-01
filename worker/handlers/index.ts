import type { JobName, JobPayloads } from "@/lib/queue";
import ping from "./ping";
import projectIngest from "./project-ingest";
import audiencesGenerate from "./audiences-generate";
import peopleFind from "./people-find";
import peopleRank from "./people-rank";
import outreachDraft from "./outreach-draft";
import receiptCheck from "./receipt-check";
import outreachSend from "./outreach-send";
import followupSchedule from "./followup-schedule";
import mailInbound from "./mail-inbound";
import postDraft from "./post-draft";
import nicheReport from "./niche-report";
import briefSend from "./brief-send";

export const handlers: { [N in JobName]: (data: JobPayloads[N]) => Promise<void> } = {
  "ping": ping,
  "project.ingest": projectIngest,
  "audiences.generate": audiencesGenerate,
  "people.find": peopleFind,
  "people.rank": peopleRank,
  "outreach.draft": outreachDraft,
  "receipt.check": receiptCheck,
  "outreach.send": outreachSend,
  "followup.schedule": followupSchedule,
  "mail.inbound": mailInbound,
  "post.draft": postDraft,
  "niche.report": nicheReport,
  "brief.send": briefSend,
};
