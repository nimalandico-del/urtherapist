from pathlib import Path

path = Path('mobile/src/screens/PsychologicalIssuesScreen.tsx')
text = path.read_text(encoding='utf-8')
old_block = "<View style={styles.categoryTitleContainer}>\n\t\t\t\t\t\t\t<Text style={styles.categoryTitle}>{group.name}</Text>\n\t\t\t\t\t\t\t<Text style={styles.categoryCount}>\n\t\t\t\t\t\t\t\t{group.issues.length} مورد\n\t\t\t\t\t\t\t</Text>\n\t\t\t\t\t\t</View>\n"
new_block = "<View style={styles.categoryTitleContainer}>\n\t\t\t\t\t\t\t<Text style={styles.categoryTitle}>{group.name}</Text>\n\t\t\t\t\t\t\t<View style={styles.categoryMetaRow}>\n\t\t\t\t\t\t\t\t<Text style={styles.categoryCount}>\n\t\t\t\t\t\t\t\t\t{group.issues.length} مورد\n\t\t\t\t\t\t\t\t</Text>\n\t\t\t\t\t\t\t\t{group.categoryId != null && categoryStats[group.categoryId] != null && (\n\t\t\t\t\t\t\t\t\t<Text style={styles.categoryTherapistCount}>\n\t\t\t\t\t\t\t\t\t\t{categoryStats[group.categoryId].therapist_count} درمانگر\n\t\t\t\t\t\t\t\t\t</Text>\n\t\t\t\t\t\t\t\t)}\n\t\t\t\t\t\t\t</View>\n\t\t\t\t\t\t</View>\n"
if old_block not in text:
    raise SystemExit('Old block not found')
path.write_text(text.replace(old_block, new_block), encoding='utf-8')
print('patched')
