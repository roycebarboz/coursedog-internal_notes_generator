## Product: Website for Non-tech users to automate the process of event notes for coursedog

**Goal:** To create a website that will automate the process of creating event notes for facilities to follow for the events they are hosting. 

**User:** Non-tech users who are responsible for creating event notes for facilities to follow for the events they are hosting. 

**Must-have features:**
1. only users which are allowed are able to access the website
2. when the user logs in they are redirected to the home page, which has a button which will redirect them to different page, on that page they can upload the CSV file, after uploading the file the website will fetch the relavant data from coursedog and display the calculated internal events notes of events and their event id
3. make use of the @coursedogeventsapi.apib for the API design and the @check_coursedog_access.py for the API access reference in Next.js 
4. to calculate the internal events noted make use of the following rules and the @automated-process-of-internal-event-notes.png:
RULES:

Template
Account Number: get from Billing Account Number section in the course dog

Reservation Number: MMDDVENUE_CODEAM/PM (Venue codes are retrived from the @Venue_Code_for_Resevation_number.txt)
(if the event is in the AM use AM else PM)

VENUE: (by default use the location name in the coursedog but for edge case use Venue_Code_for_Venue_dictionary dictionary)

SETUP_INSTRUCTION (Already present in the internal events notes if not contact superisor)

Setup time:
 *By default 2 hrs before the event

Edge Cases:
a. there should be no setup time between 12-1 pm (lunch break)

b. Facilities work hours: 8:00 AM - 5:00 PM so if the event is early of eg: 8 AM then setup at 6 AM

c. setup time should not overlap between any other event happening in that venue (also consider events which has no setup)

d. if there is an event before this and there is no time for setup that is less then 60 min notify manager, and if there is 1 hour for the setup use SHARP an the end of the setup time eg: 9 AM SHARP

e. If the event is after 5 PM and there is no event happening at that venue then put setup time at 11 AM

Breakdown time
 *By default its ncxt day in the AM
Edge Cases:
a. if there is an event happening after this which has event setup in the same venue then put the breakdown in the PM
 
b.  if the event is on the weekend and there is no event in that space after it on the weekends the put breakdown on Monday in the AM

Multi-day events rule:
If the same event ID spans multiple consecutive calendar days, generate ONE internal event note. The reservation number uses the first day's date (MMDD). Setup time is before the first day; breakdown is after the last day.

Early-morning setup prior-day rule:
If 2 hours before the event start would land before 8 AM (e.g., event starts at 9 AM), set setup time to the previous day at 4 PM instead of capping at 6 AM, only if there is no event in that venue after 4 PM. (Exception: it costs more on the weekends to host an event, as facilities charge extra on weekends, so if the event is on Monday morning, put the setup time 2 hrs before the event time.)

5. make use of the @events-report.csv for the internal events notes reference to get idea to create the internal events notes (because the rules are not black and white and there are edge cases which are not covered in the rules for example same event is booked in two differnet buildings so for that we creare two diffrent internal event notes for each building)




**Tech stack:** Next.js, and vercel for deployment

**Deliverable:** Next.js backend code