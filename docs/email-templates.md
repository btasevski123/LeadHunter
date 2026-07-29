# Outreach email templates

Source of truth in code: `packages/audit-engine/src/email-generator.ts`  
Facts come from: `packages/audit-engine/src/outreach-analysis.ts`

Emails are filled from these templates only (no AI). Each draft uses:

- **1** positive observation (if the analyzer found one)
- **1** primary issue (if any)
- Soft CTA + closing

Placeholders:

| Slot | Meaning |
|------|---------|
| `{{greeting}}` | `Здраво,` / `Hi,` or with contact name |
| `{{company}}` | Company name |
| `{{city}}` | City (optional; no-website templates) |
| `{{positive}}` | Positive clause (see list below) |
| `{{issue}}` | One issue observation (see list below) |
| `{{close}}` | `Поздрав,` / `Best,` (+ sender name/company if set) |

---

## MK — Outreach (has website)

**Subject:** `{{company}}`

```
{{greeting}}

Го најдов {{company}} додека разгледував локални бизниси и го погледнав вашиот веб-сајт.

Забележав дека {{positive}}.

Имаше една работа која мислам дека би можела да се подобри:

{{issue}}

Сакав само да ви го споделам ова бидејќи веб-сајтот често е првата точка каде што некој се запознава со компанијата.

Доколку сакате, можам да ви испратам неколку конкретни предлози без никаква обврска.

{{close}}
```

- Remove the “Забележав дека …” line when no positive exists.
- Remove the issue intro + `{{issue}}` when no issue exists.

---

## MK — No website

**Subject:** `{{company}}`

```
{{greeting}}

Додека разгледував компании во {{city}}, наидов на {{company}}.

Забележав дека моментално немате веб-сајт.

Многу компании денес добиваат нови клиенти преку онлајн пребарување, па едноставна веб-страница може да биде корисна како место каде луѓето ќе најдат информации, услуги и контакт.

Доколку сакате, можам да ви испратам пример како би можело да изгледа едноставно решение за вашиот бизнис.

{{close}}
```

(`во {{city}}` is omitted when city is missing.)

---

## MK — Follow-up

**Subject:** `Кратка порака за {{company}}`

```
{{greeting}}

Само кратко да се надоврзам на претходната порака за {{company}}.

Не сакам да ви одземам време, само сакав да проверам дали би сакале да ви испратам неколку идеи за можни подобрувања.

Доколку моментално не е приоритет, нема никаков проблем.

Ви посакувам успешна работа.

{{close}}
```

---

## EN — Outreach (has website)

**Subject:** `{{company}}`

```
{{greeting}}

I found {{company}} while looking through local businesses and took a look at your website.

I noticed that {{positive}}.

There was one thing I thought could be improved:

{{issue}}

I just wanted to share this because a website is often the first place where people get to know a company.

If you'd like, I can send a few specific suggestions with no obligation.

{{close}}
```

- Remove positive sentence when no positive exists.
- Remove issue section when no issue exists.

---

## EN — No website

**Subject:** `{{company}}`

```
{{greeting}}

While looking through businesses in {{city}}, I came across {{company}}.

I noticed that you currently do not have a website.

Many businesses today get discovered through online searches, and a simple website can be a useful place where people can find information, services, and contact details.

If you'd like, I can send an example of what a simple solution for your business could look like.

{{close}}
```

(`in {{city}}` is omitted when city is missing.)

---

## EN — Follow-up

**Subject:** `Quick note for {{company}}`

```
{{greeting}}

Just a quick follow-up on my previous message about {{company}}.

I don't want to take much of your time, I just wanted to check if you'd like me to send a few ideas for possible improvements.

If now is not the right time, no problem at all.

Wishing you continued success.

{{close}}
```

---

## Positive slots (`{{positive}}`)

| Analyzer key | MK | EN |
|--------------|----|----|
| Contact information is easy to find | контакт информациите лесно се наоѓаат | contact information is easy to find |
| Services are clearly explained | услугите се јасно објаснети | services are clearly explained |
| Strong local brand presence | имате добро присуство како локален бизнис | you have a strong local presence |
| Professional photography | имате квалитетни фотографии | you have good quality photography |
| Simple navigation | навигацијата е едноставна | navigation is simple |
| Works well on mobile | сајтот добро се гледа на телефон | the website works well on mobile |
| Site loads over HTTPS | страницата користи безбедна врска | the website uses a secure connection |
| Modern visual design | дизајнот изгледа современо | the design looks modern |

---

## Issue slots (`{{issue}}`) — one primary observation

Only the **first** analyzer issue is used. Wording stays constructive (no “outdated / losing customers”).

### MK

| Analyzer key | Text |
|--------------|------|
| Not mobile friendly | На телефон, приказот би можел да биде појасен и полесен за користење. |
| No HTTPS | Страницата би можела да користи безбедна HTTPS врска. |
| Outdated visual design | Визуелниот приказ би можел да изгледа посвежо и појасно. |
| No clear way to get in touch | Би било полесно ако има јасен начин да се прати барање директно од страницата. |
| Pages feel slow | Страницата би можела да се отвора побрзо. |
| Website is offline or unreachable | Моментално страницата не се отвора стабилно. |
| No active website | Моментално нема активна веб-страница. |

### EN

| Analyzer key | Text |
|--------------|------|
| Not mobile friendly | On mobile, the layout could be clearer and easier to use. |
| No HTTPS | The website could use a secure HTTPS connection. |
| Outdated visual design | The visual presentation could look fresher and clearer. |
| No clear way to get in touch | It would help to have a clearer way to send an inquiry from the page. |
| Pages feel slow | The pages could open a bit faster. |
| Website is offline or unreachable | The website does not open reliably at the moment. |
| No active website | There does not appear to be an active website right now. |

---

## Greeting & closing

| | MK | EN |
|---|----|----|
| Greeting (no name) | `Здраво,` | `Hi,` |
| Greeting (with name) | `Здраво {{name}},` | `Hi {{name}},` |
| Close (no sender) | `Поздрав,` | `Best,` |
| Close (with sender) | `Поздрав,` + name / company | `Best,` + name / company |

Sender lines come from `SMTP_FROM_NAME` / `SENDER_COMPANY` when set.
