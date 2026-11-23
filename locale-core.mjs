import {WORKFLOW_LOCALES} from './locale-workflow.mjs';
import {DETAIL_LOCALES} from './locale-detail.mjs';
import {BASEMAP_LOCALES} from './locale-basemap.mjs';
import {CODEGEN_LOCALES} from './locale-codegen.mjs';
import {WORLD_LOCALES} from './locale-world.mjs';
import {EXTENDED_TEXT} from './locale-extended.mjs';
export const LANGUAGES={'zh-Hant':'繁體中文','zh-Hans':'简体中文',en:'English',es:'Español',fr:'Français',de:'Deutsch',ja:'日本語',ko:'한국어',ru:'Русский',ar:'العربية',hi:'हिन्दी'};
// Application-owned copy is translated; imported data and source names are preserved.
const rows=`
Help|Ayuda|Aide|Hilfe|ヘルプ|도움말|Справка|مساعدة|सहायता
Export map|Exportar mapa|Exporter la carte|Karte exportieren|地図を書き出す|지도 내보내기|Экспорт карты|تصدير الخريطة|मानचित्र निर्यात करें
01 Data|01 Datos|01 Données|01 Daten|01 データ|01 데이터|01 Данные|01 البيانات|01 डेटा
02 Style|02 Estilo|02 Style|02 Gestaltung|02 スタイル|02 스타일|02 Стиль|02 النمط|02 शैली
03 Export|03 Exportar|03 Export|03 Export|03 出力|03 내보내기|03 Экспорт|03 التصدير|03 निर्यात
Import records|Importar registros|Importer des observations|Datensätze importieren|記録を読み込む|기록 가져오기|Импорт записей|استيراد السجلات|रिकॉर्ड आयात करें
Global demo|Ejemplo mundial|Exemple mondial|Weltweites Beispiel|世界のサンプル|세계 예제|Мировой пример|مثال عالمي|वैश्विक उदाहरण
Taiwan demo|Ejemplo de Taiwán|Exemple de Taïwan|Taiwan-Beispiel|台湾のサンプル|대만 예제|Пример Тайваня|مثال تايوان|ताइवान उदाहरण
Choose or drop a CSV here|Elegir o arrastrar un CSV|Choisir ou déposer un CSV|CSV auswählen oder hier ablegen|CSV を選択またはドロップ|CSV 선택 또는 끌어놓기|Выберите или перетащите CSV|اختر ملف CSV أو اسحبه هنا|CSV चुनें या यहाँ खींचें
Use UTF-8 encoding to preserve special characters.|Usa la codificación UTF-8 para conservar los caracteres especiales.|Utilisez l’encodage UTF-8 pour conserver les caractères spéciaux.|Verwenden Sie UTF-8, um Sonderzeichen zu erhalten.|特殊文字を保持するには、UTF-8 で保存してください。|특수 문자를 유지하려면 UTF-8 인코딩으로 저장하세요.|Чтобы сохранить специальные символы, используйте кодировку UTF-8.|استخدم ترميز UTF-8 للحفاظ على الأحرف الخاصة.|विशेष वर्णों को सुरक्षित रखने के लिए UTF-8 एन्कोडिंग में सहेजें।
Text encoding|Codificación|Encodage|Zeichenkodierung|文字コード|문자 인코딩|Кодировка|ترميز النص|पाठ एन्कोडिंग
Column mapping|Asignación de columnas|Correspondance des colonnes|Spaltenzuordnung|列の対応|열 매핑|Сопоставление столбцов|تعيين الأعمدة|स्तंभ मिलान
Longitude|Longitud|Longitude|Längengrad|経度|경도|Долгота|خط الطول|देशांतर
Latitude|Latitud|Latitude|Breitengrad|緯度|위도|Широта|خط العرض|अक्षांश
Taxon / group|Taxón / grupo|Taxon / groupe|Taxon / Gruppe|分類群／グループ|분류군 / 그룹|Таксон / группа|الصنف / المجموعة|वर्गक / समूह
Taxa, colors & symbols|Taxones, colores y símbolos|Taxons, couleurs et symboles|Taxa, Farben und Symbole|分類群・色・記号|분류군, 색상 및 기호|Таксоны, цвета и символы|الأصناف والألوان والرموز|वर्गक, रंग और चिह्न
Select all|Seleccionar todo|Tout sélectionner|Alle auswählen|すべて選択|모두 선택|Выбрать всё|تحديد الكل|सभी चुनें
Assign symbols|Asignar símbolos|Attribuer les symboles|Symbole zuweisen|記号を自動割り当て|기호 자동 할당|Назначить символы|تعيين الرموز|चिह्न निर्धारित करें
Map preview|Vista del mapa|Aperçu de la carte|Kartenvorschau|地図プレビュー|지도 미리보기|Предпросмотр карты|معاينة الخريطة|मानचित्र पूर्वावलोकन
Data table|Tabla de datos|Tableau de données|Datentabelle|データ表|데이터 표|Таблица данных|جدول البيانات|डेटा तालिका
Legend studio|Editor de leyendas|Atelier des légendes|Legendenstudio|凡例エディター|범례 편집기|Редактор легенд|محرر وسائل الإيضاح|संकेत संपादक
All legends|Todas las leyendas|Toutes les légendes|Alle Legenden|すべての凡例|모든 범례|Все легенды|جميع وسائل الإيضاح|सभी संकेत
Taxon legend|Leyenda de taxones|Légende des taxons|Taxon-Legende|分類群の凡例|분류군 범례|Легенда таксонов|مفتاح الأصناف|वर्गक संकेत
Elevation legend|Leyenda de altitud|Légende des altitudes|Höhenlegende|標高の凡例|고도 범례|Легенда высот|مفتاح الارتفاع|ऊँचाई संकेत
Depth legend|Leyenda de profundidad|Légende des profondeurs|Tiefenlegende|水深の凡例|수심 범례|Легенда глубин|مفتاح الأعماق|गहराई संकेत
Rivers & lakes legend|Leyenda de ríos y lagos|Légende des cours d’eau et lacs|Fluss- und Seenlegende|河川・湖の凡例|강·호수 범례|Легенда рек и озёр|مفتاح الأنهار والبحيرات|नदी और झील संकेत
Custom title|Título personalizado|Titre personnalisé|Eigener Titel|タイトル|사용자 지정 제목|Свой заголовок|عنوان مخصص|कस्टम शीर्षक
Font family|Tipografía|Police|Schriftart|フォント|글꼴|Шрифт|نوع الخط|फ़ॉन्ट
Title size|Tamaño del título|Taille du titre|Titelgröße|タイトルの文字サイズ|제목 크기|Размер заголовка|حجم العنوان|शीर्षक आकार
Text size|Tamaño del texto|Taille du texte|Textgröße|文字サイズ|글자 크기|Размер текста|حجم النص|पाठ आकार
Bold|Negrita|Gras|Fett|太字|굵게|Жирный|عريض|मोटा
Italic|Cursiva|Italique|Kursiv|斜体|기울임|Курсив|مائل|तिरछा
Text color|Color del texto|Couleur du texte|Textfarbe|文字色|글자 색|Цвет текста|لون النص|पाठ का रंग
White background|Fondo blanco|Fond blanc|Weißer Hintergrund|白い背景|흰색 배경|Белый фон|خلفية بيضاء|सफेद पृष्ठभूमि
Border|Borde|Bordure|Rahmen|枠線|테두리|Рамка|إطار|किनारा
Legend columns|Columnas de leyenda|Colonnes de légende|Legendenspalten|凡例の列数|범례 열 수|Столбцы легенды|أعمدة المفتاح|संकेत स्तंभ
Elevation (m)|Altitud (m)|Altitude (m)|Höhe (m)|標高（m）|고도 (m)|Высота (м)|الارتفاع (م)|ऊँचाई (मी)
Species|Especies|Espèces|Arten|種|종|Виды|الأنواع|प्रजातियाँ
Groups|Grupos|Groupes|Gruppen|グループ|그룹|Группы|المجموعات|समूह
Elevation distribution|Distribución altitudinal|Distribution altitudinale|Höhenverteilung|標高分布|고도 분포|Высотное распределение|التوزيع الارتفاعي|ऊँचाई वितरण
Original elevation (CSV)|Altitud original (CSV)|Altitude d’origine (CSV)|Originalhöhe (CSV)|元の標高（CSV）|원본 고도 (CSV)|Исходная высота (CSV)|الارتفاع الأصلي (CSV)|मूल ऊँचाई (CSV)
DEM-estimated elevation|Altitud estimada por DEM|Altitude estimée par MNT|DEM-Höhenschätzung|DEM 推定標高|DEM 추정 고도|Высота по ЦМР|ارتفاع مقدّر من DEM|DEM अनुमानित ऊँचाई
CSV first; fill missing with DEM|Priorizar CSV; completar con DEM|Priorité au CSV ; compléter par MNT|CSV bevorzugen; Lücken mit DEM füllen|CSV 優先・欠測を DEM で補完|CSV 우선, 결측값은 DEM으로|CSV, пропуски — по ЦМР|CSV أولاً؛ إكمال النواقص من DEM|पहले CSV; रिक्त मान DEM से
Unique sites|Sitios únicos|Sites uniques|Einzelne Fundorte|重複を除く地点|중복 제거 지점|Уникальные точки|المواقع الفريدة|अद्वितीय स्थल
All records|Todos los registros|Toutes les observations|Alle Datensätze|すべての記録|모든 기록|Все записи|جميع السجلات|सभी रिकॉर्ड
Median|Mediana|Médiane|Median|中央値|중앙값|Медиана|الوسيط|माध्यिका
Core range (25–75%)|Intervalo central (25–75 %)|Intervalle central (25–75 %)|Kernbereich (25–75 %)|中央範囲（25–75%）|중심 범위 (25–75%)|Центральный диапазон (25–75%)|النطاق المركزي (25–75٪)|मध्य सीमा (25–75%)
Minimum–maximum|Mínimo–máximo|Minimum–maximum|Minimum–Maximum|最小–最大|최소–최대|Минимум–максимум|الحد الأدنى–الأقصى|न्यूनतम–अधिकतम
Elevation column (meters)|Columna de altitud (metros)|Colonne d’altitude (mètres)|Höhenspalte (Meter)|標高列（メートル）|고도 열 (미터)|Столбец высоты (метры)|عمود الارتفاع (متر)|ऊँचाई स्तंभ (मीटर)
Elevation source|Fuente de altitud|Source des altitudes|Höhenquelle|標高の取得元|고도 출처|Источник высот|مصدر الارتفاع|ऊँचाई का स्रोत
Statistical unit|Unidad estadística|Unité statistique|Statistische Einheit|集計単位|통계 단위|Единица анализа|وحدة التحليل|सांख्यिकीय इकाई
Estimate / compare DEM|Estimar / comparar DEM|Estimer / comparer le MNT|DEM schätzen / vergleichen|DEM 推定・比較|DEM 추정 / 비교|Рассчитать / сравнить ЦМР|تقدير / مقارنة DEM|DEM अनुमान / तुलना
Cancel|Cancelar|Annuler|Abbrechen|キャンセル|취소|Отмена|إلغاء|रद्द करें
Elevation demo|Ejemplo altitudinal|Exemple altitudinal|Höhenbeispiel|標高サンプル|고도 예제|Пример высот|مثال ارتفاعات|ऊँचाई उदाहरण
Show records|Mostrar registros|Afficher les observations|Datensätze anzeigen|記録を表示|기록 표시|Показать записи|عرض السجلات|रिकॉर्ड दिखाएँ
Show sample size|Mostrar tamaño muestral|Afficher l’effectif|Stichprobengröße anzeigen|標本数を表示|표본 수 표시|Показать объём выборки|عرض حجم العينة|नमूना आकार दिखाएँ
Elevation bands|Bandas altitudinales|Étages d’altitude|Höhenstufen|標高帯|고도 구간|Высотные пояса|نطاقات الارتفاع|ऊँचाई क्षेत्र
Band boundaries (comma-separated)|Límites de bandas (separados por comas)|Limites des bandes (séparées par virgules)|Stufengrenzen (kommagetrennt)|標高帯の境界（カンマ区切り）|구간 경계 (쉼표로 구분)|Границы поясов (через запятую)|حدود النطاقات (مفصولة بفواصل)|क्षेत्र सीमाएँ (अल्पविराम से)
Band labels|Etiquetas de bandas|Libellés des bandes|Stufenbeschriftung|標高帯のラベル|구간 이름|Названия поясов|تسميات النطاقات|क्षेत्र नाम
Apply bands|Aplicar bandas|Appliquer les bandes|Stufen anwenden|標高帯を適用|구간 적용|Применить пояса|تطبيق النطاقات|क्षेत्र लागू करें
Download comparison CSV|Descargar comparación CSV|Télécharger la comparaison CSV|Vergleich als CSV herunterladen|比較 CSV を保存|비교 CSV 다운로드|Скачать сравнение CSV|تنزيل مقارنة CSV|तुलना CSV डाउनलोड करें
Download summary CSV|Descargar resumen CSV|Télécharger le résumé CSV|Zusammenfassung als CSV|集計 CSV を保存|요약 CSV 다운로드|Скачать сводку CSV|تنزيل ملخص CSV|सारांश CSV डाउनलोड करें
Export chart|Exportar gráfico|Exporter le graphique|Diagramm exportieren|グラフを書き出す|차트 내보내기|Экспорт графика|تصدير الرسم|चार्ट निर्यात करें
No elevation data to plot yet|Aún no hay altitudes para graficar|Aucune altitude à représenter|Noch keine Höhendaten vorhanden|表示できる標高データがありません|표시할 고도 데이터가 없습니다|Нет высот для графика|لا توجد بيانات ارتفاع للرسم|चित्रण हेतु ऊँचाई डेटा नहीं
None|Ninguna|Aucune|Keine|なし|없음|Нет|لا شيء|कोई नहीं
Language|Idioma|Langue|Sprache|言語|언어|Язык|اللغة|भाषा
Chart style|Estilo del gráfico|Style du graphique|Diagrammgestaltung|グラフのスタイル|차트 스타일|Стиль диаграммы|نمط الرسم|चार्ट शैली
File format|Formato de archivo|Format du fichier|Dateiformat|ファイル形式|파일 형식|Формат файла|صيغة الملف|फ़ाइल प्रारूप
Language preview: some advanced notes are in English.|Vista previa: algunas notas avanzadas están en inglés.|Aperçu : certaines notes avancées sont en anglais.|Sprachvorschau: Einige erweiterte Hinweise sind auf Englisch.|言語の試用版：一部の詳細説明は英語です。|언어 미리보기: 일부 고급 설명은 영어입니다.|Пробная локализация: часть пояснений на английском.|معاينة اللغة: بعض الشروحات المتقدمة بالإنجليزية.|भाषा पूर्वावलोकन: कुछ विस्तृत निर्देश अंग्रेज़ी में हैं।
`;
export const LOCALE_TEXT=Object.fromEntries(['es','fr','de','ja','ko','ru','ar','hi'].map((lang,i)=>[lang,{...Object.fromEntries(rows.trim().split('\n').map(row=>{const parts=row.split('|');return [parts[0],parts[i+1]];})),...EXTENDED_TEXT[lang],...WORLD_LOCALES[lang],...CODEGEN_LOCALES[lang],...BASEMAP_LOCALES[lang],...DETAIL_LOCALES[lang]}]));

const compactRows=`CSV files only.|Solo archivos CSV.|Fichiers CSV uniquement.|Nur CSV-Dateien.|CSVファイルのみ。|CSV 파일만 허용됩니다.|Только файлы CSV.|ملفات CSV فقط.|केवल CSV फ़ाइलें।
Save the file as UTF-8 CSV and try again.|Guarde el archivo como CSV UTF-8 e inténtelo de nuevo.|Enregistrez le fichier au format CSV UTF-8 et réessayez.|Speichern Sie die Datei als UTF-8-CSV und versuchen Sie es erneut.|UTF-8 CSV形式で保存して再度お試しください。|UTF-8 CSV로 저장한 후 다시 시도하세요.|Сохраните файл как CSV UTF-8 и повторите попытку.|احفظ الملف بصيغة CSV بترميز UTF-8 وحاول مجددًا.|फ़ाइल को UTF-8 CSV के रूप में सहेजें और फिर प्रयास करें।
Map labels and layers|Etiquetas y capas del mapa|Étiquettes et couches de la carte|Kartenbeschriftungen und Ebenen|地図ラベルとレイヤー|지도 이름 및 레이어|Подписи и слои карты|تسميات الخريطة وطبقاتها|मानचित्र लेबल और परतें
Terrain settings|Configuración del relieve|Paramètres du relief|Geländeeinstellungen|地形設定|지형 설정|Настройки рельефа|إعدادات التضاريس|भूभाग सेटिंग
Advanced data settings|Configuración avanzada de datos|Paramètres avancés des données|Erweiterte Dateneinstellungen|データの詳細設定|고급 데이터 설정|Расширенные настройки данных|إعدادات البيانات المتقدمة|उन्नत डेटा सेटिंग
Advanced point settings|Configuración avanzada de puntos|Paramètres avancés des points|Erweiterte Punkteinstellungen|地点の詳細設定|고급 지점 설정|Расширенные настройки точек|إعدادات النقاط المتقدمة|उन्नत बिंदु सेटिंग
Advanced legend settings|Configuración avanzada de leyenda|Paramètres avancés de légende|Erweiterte Legendeneinstellungen|凡例の詳細設定|고급 범례 설정|Расширенные настройки легенды|إعدادات مفتاح الخريطة المتقدمة|उन्नत संकेत-सूची सेटिंग
`;
for(const row of compactRows.trim().split("\n")){const parts=row.split("|");["es","fr","de","ja","ko","ru","ar","hi"].forEach((lang,i)=>LOCALE_TEXT[lang][parts[0]]=parts[i+1]);}

for(const [lang,pack] of Object.entries(WORKFLOW_LOCALES))Object.assign(LOCALE_TEXT[lang],pack);
