// Timetable data and UL/LI markup transcribed from the supplied portal HTML.
// No profile, student number, remote resources or personal navigation included.
const days = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"];
const slots = [
  ["08:30-09:20", "", "", "", "CMSE443/CMPE026", "CMSE423/CMPE025"],
  ["09:30-10:20", "", "", "", "CMSE443/CMPE026", "CMSE423/CMPE025"],
  ["10:30-11:20", "", "", "MGMT101/CL 114", "CMSE456/CMPE126", ""],
  ["11:30-12:20", "", "", "MGMT101/CL 114", "CMSE456/CMPE126", ""],
  ["12:30-13:20", "CMSE423/CMPE025", "MGMT101/CL 116", "CMSE423/CMPE230|CMSE456/CMPE134", "", "CMSE456/CMPE128"],
  ["13:30-14:20", "CMSE423/CMPE025", "", "CMSE423/CMPE230|CMSE456/CMPE134", "", "CMSE456/CMPE128"],
  ["14:30-15:20", "CMSE443/CMPE230", "CMSE425/CMPE127", "", "CMSE425/CMPE127", "CMSE443/CMPE126"],
  ["15:30-16:20", "CMSE443/CMPE230", "CMSE425/CMPE127", "", "CMSE425/CMPE127", "CMSE443/CMPE126"],
  ["16:30-17:20", "", "CMSE425/CMPE137", "", "", ""],
  ["17:30-18:20", "", "CMSE425/CMPE137", "", "", ""],
  ["18:30-19:20"], ["19:30-20:20"], ["20:30-21:20"], ["21:30-22:20"], ["22:30-23:20"],
];

function links(courses: string): string {
  return courses.split("|").map((course) =>
    `<a href="https://maps.google.com/maps?f=d&amp;daddr=35.146049,33.908502" target="_blank">${course}</a>`,
  ).join("<br>");
}

export function portalTimetable(): string {
  const desktop = slots.map(([time, ...courses]) => `<ul><li>${time}</li>${days.map((_, day) => {
    const course = courses[day];
    return course ? `<li class="ctime"><span><strong>${links(course)}</strong></span></li>` : '<li class="empty"></li>';
  }).join("")}</ul>`).join("");
  const mobile = days.map((day, index) => `<ul><li>${day}</li>${slots.map(([time, ...courses]) => {
    const course = courses[index];
    return course ? `<li class="ctime"><span><b>${time}</b><br><strong>${links(course)}</strong></span></li>` : "";
  }).join("")}</ul>`).join("");
  return `<div id="schedule_content" class="schedule-content"><div class="schedule-panel"><div class="row">
    <div class="schedule-table-heading"><ul><li>Time</li>${days.map((day) => `<li>${day}</li>`).join("")}</ul></div>
    <div class="schedule-table-content">${desktop}</div>
    <div class="schedule-table-content-mobile">${mobile}</div>
  </div></div></div>`;
}
