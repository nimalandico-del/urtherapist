import re
from pathlib import Path

path = Path('mobile/src/screens/PsychologicalIssuesScreen.tsx')
text = path.read_text(encoding='utf-8')
pattern = re.compile(
    r"(<View style=\{styles\.categoryTitleContainer\}>\s*"
    r"<Text style=\{styles\.categoryTitle\}>\{group\.name\}</Text>\s*)"
    r"(<Text style=\{styles\.categoryCount\}>\s*"
    r"\{group\.issues\.length\} مورد\s*"  # issue count block
    r"</Text>\s*</View>)",
    re.DOTALL,
)

match = pattern.search(text)
if not match:
    raise SystemExit('Pattern not found')

replacement = (
    match.group(1)
    + '<View style={styles.categoryMetaRow}>'
    + '\n\t\t\t\t\t\t\t\t<Text style={styles.categoryCount}>'
    + '\n\t\t\t\t\t\t\t\t\t{group.issues.length} مورد'
    + '\n\t\t\t\t\t\t\t\t</Text>'
    + '\n\t\t\t\t\t\t\t\t{group.categoryId != null && categoryStats[group.categoryId] != null && ('
    + '\n\t\t\t\t\t\t\t\t\t<Text style={styles.categoryTherapistCount}>'
    + '\n\t\t\t\t\t\t\t\t\t\t{categoryStats[group.categoryId].therapist_count} درمانگر'
    + '\n\t\t\t\t\t\t\t\t\t</Text>'
    + '\n\t\t\t\t\t\t\t\t)}'
    + '\n\t\t\t\t\t\t\t</View>'
    + '\n\t\t\t\t\t</View>'
)
new_text = text[: match.start()] + replacement + text[match.end() :]
path.write_text(new_text, encoding='utf-8')
print('patched')
