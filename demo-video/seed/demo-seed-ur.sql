-- Urdu edition of the demo content — applied ON TOP of demo-seed.sql by
-- `seed/seed.sh ur`. Only user-written content changes (titles, names, places,
-- stories, updates, supporter messages); the trust rows, organisations and
-- amounts are shared with the English edition. Organisation names stay as the
-- businesses write them.
\set ON_ERROR_STOP on
begin;

create temp table seed_ur (slug text, title text, name text, city text, country text, burial text, story text) on commit drop;
insert into seed_ur values
 ('demo-bringing-amir-home','امیر کو گھر واپس لانا','امیر حسین','برلن','جرمنی','لاہور',
  'امیر آٹھ سال پہلے ایک خاموش خواب لے کر برلن آئے تھے: لاہور میں اپنی بیوی ثناء اور دو چھوٹے بچوں کے لیے بہتر زندگی بنانا۔ وہ ایک لاجسٹکس ویئرہاؤس میں ڈبل شفٹیں کرتے تھے اور گھر فون کرنا کبھی نہیں بھولتے تھے۔

پچھلے ہفتے امیر کام کے دوران گر پڑے اور جانبر نہ ہو سکے۔ اُن کے خاندان کی ایک ہی خواہش ہے: اُنہیں گھر واپس لانا، تاکہ اُن کی ماں اُنہیں الوداع کہہ سکیں اور وہ اپنے والد کے پہلو میں دفن ہو سکیں۔

یہ کیمپین امیر کو لاہور واپس لانے کا خرچ پورا کرتی ہے۔ ہر یورو سیدھا برلن کے Al-Amanah Funeral Services کو جاتا ہے، جو ویریفائیڈ پارٹنر ہے اور غسل، ایمبیسی کے کاغذات اور گھر تک کی فلائٹ کا انتظام کرتا ہے۔ کسی فرد کو کچھ ادا نہیں کیا جاتا۔'),
 ('demo-khan-family','خان فیملی کے ساتھ کھڑے ہوں','بلال خان','لندن','برطانیہ','پشاور',
  'بلال خان پندرہ سال لندن میں بس چلاتے رہے اور ہر مسافر کو نام سے سلام کرتے تھے۔ وہ اچانک اُس گاؤں سے بہت دور انتقال کر گئے جہاں پشاور میں وہ پیدا ہوئے تھے۔

خاندان کی ایک ہی درخواست ہے: اُنہیں گھر واپس لانا۔ یہ کیمپین بلال کی باڈی کو پشاور پہنچانے کا خرچ پورا کرتی ہے، جو سیدھا لندن کے Crescent Funeral Services، ہمارے ویریفائیڈ پارٹنر، کو ادا ہوتا ہے۔'),
 ('demo-farewell-mariam','مریم کی باعزت رخصتی','مریم سید','لزبن','پرتگال','کراچی',
  'مریم سید نے بیس سال لزبن میں ایک نرس کے طور پر دوسروں کے خاندانوں کی دیکھ بھال کی۔ وہ نرم دل، صابر اور بے حد مہربان تھیں۔

کراچی میں اُن کا خاندان اُنہیں والدین کے پہلو میں دفن کرنا چاہتا ہے۔ یہ کیمپین مریم کو گھر لانے کا خرچ پورا کرتی ہے، جس کا پورا انتظام لزبن کا ویریفائیڈ پارٹنر فیونرل ہوم Servilusa کرے گا، اور پاکستانی ایمبیسی کاغذات کی تصدیق کرے گی۔'),
 ('demo-carry-yusuf-home','یوسف کو اُس کی ماں کے پاس پہنچائیں','یوسف علی','مانچسٹر','برطانیہ','سیالکوٹ',
  'یوسف چھبیس سال کے تھے۔ وہ مانچسٹر میں کنسٹرکشن سائٹس پر کام کرتے تھے اور ہر شام اپنی ماں کو فون کرتے تھے، ایک دن بھی ناغہ نہیں۔ ماں کی ایک ہی درخواست ہے کہ اپنے بیٹے کو آخری بار گلے لگا سکیں۔

یہ کیمپین یوسف کو سیالکوٹ واپس لاتی ہے۔ فنڈز سیدھے مانچسٹر کے Northern Janazah Services کو جاتے ہیں، جو ویریفائیڈ پارٹنر ہے اور واپسی کا انتظام کر رہا ہے۔'),
 ('demo-begum-children','بیگم بچوں کے لیے مدد','فاطمہ بیگم','میلان','اٹلی','ملتان',
  'فاطمہ بیگم کام کے لیے میلان آئیں اور جو کچھ کما سکیں ملتان میں اپنے چار بچوں کو بھیجتی رہیں۔ وہ اچانک انتقال کر گئیں، اور اُن کے بچے اُنہیں گھر پر، اپنے قریب دفن کرنا چاہتے ہیں۔

یہ کیمپین فاطمہ کو ملتان لانے کا خرچ پورا کرتی ہے، میلان کے ویریفائیڈ پارٹنر Casa Funeraria Al-Salam کے ذریعے۔ پیسے کسی پرائیویٹ ہاتھ سے نہیں گزرتے۔'),
 ('demo-farewell-rashid','راشد کی باعزت رخصتی','راشد اقبال','میونخ','جرمنی','راولپنڈی',
  'راشد اقبال ایک دہائی سے زیادہ میونخ میں ایک محبوب امام اور کمیونٹی کا خاموش ستون تھے۔ جب وہ انتقال کر گئے، تو جس کمیونٹی کا اُنہوں نے خیال رکھا تھا وہ اُن کے لیے اکٹھی ہو گئی۔

چند ہی دنوں میں ہدف پورا ہو گیا اور فنڈز میونخ کے Bestattungen Al-Huda کو ریلیز کر دیے گئے، جو راشد کو عزت کے ساتھ راولپنڈی واپس لے آئے۔'),
 ('demo-pending-noor','نور کے خاندان کو الوداع کہنے میں مدد','نور بیگم','ایمسٹرڈیم','نیدرلینڈز','کراچی',
  'نور تین بچوں کی ایک نہایت شفیق ماں تھیں جنہوں نے کئی سال ایمسٹرڈیم میں کام کیا۔ اُن کا خاندان اُنہیں تدفین کے لیے کراچی واپس لانے میں مدد چاہتا ہے۔

واپسی کا انتظام ایمسٹرڈیم کا ویریفائیڈ پارٹنر Uitvaart Al-Baraka کرے گا؛ فنڈز ضرورت کی ویریفکیشن کے بعد ہی اُنہیں ریلیز ہوں گے۔');

update campaigns c
   set title = u.title, deceased_name = u.name, death_city = u.city, death_country = u.country,
       repatriation_city = u.burial, story = u.story
  from seed_ur u where u.slug = c.slug;

-- Supporter wall for Amir, in Urdu.
create temp table seed_ur_msgs (donor_name text, message text) on commit drop;
insert into seed_ur_msgs values
 ('سارہ ملک','امیر کے بچوں کے لیے دعائیں۔ اللہ اُنہیں جنت میں جگہ دے۔'),
 ('عمر ف۔','وہ اچھے انسان اور اچھے پڑوسی تھے۔ بہت جلد چلے گئے۔'),
 ('صدیقی خاندان','ہمارے خاندان کی طرف سے آپ کے خاندان کے لیے۔ آپ اکیلے نہیں ہیں۔'),
 ('حنا','دعا ہے کہ وہ خیریت سے گھر پہنچ جائیں۔ 🤍'),
 ('بلال ر۔',null),
 ('ویڈنگ، برلن کی کمیونٹی','اُن کی مسجد کی کمیونٹی خاندان کے ساتھ کھڑی ہے۔');
with amir as (select id from campaigns where slug = 'demo-bringing-amir-home'),
     rows as (select d.id, row_number() over (order by d.created_at desc) rn from donations d, amir where d.campaign_id = amir.id and d.is_anonymous = false),
     msgs as (select *, row_number() over () rn from seed_ur_msgs)
update donations d set donor_name = m.donor_name, message = m.message
  from rows r join msgs m on m.rn = r.rn where d.id = r.id;
update donations set message = 'چھوٹی سی مدد، بڑی دعائیں۔' where is_anonymous and message is not null
   and campaign_id = (select id from campaigns where slug = 'demo-bringing-amir-home');

-- Updates from the family, in Urdu.
delete from campaign_updates where campaign_id = (select id from campaigns where slug = 'demo-bringing-amir-home');
insert into campaign_updates (campaign_id, author_id, body, created_at)
select c.id, c.organizer_id,
       'Al-Amanah نے تصدیق کی ہے کہ ایمبیسی کا NOC جاری ہو گیا ہے اور لاہور کی فلائٹ اس جمعہ کے لیے بُک ہو چکی ہے۔ لال فنڈز سیدھے اُنہیں ریلیز کرتا ہے، اس لیے خاندان کو ایک بھی ادائیگی خود نہیں کرنی پڑی۔ شکریہ — آپ سب نے اس بوجھ کا ایک ایک حصہ اٹھایا ہے۔',
       now() - interval '2 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home'
union all
select c.id, c.organizer_id,
       'آج صبح ویڈنگ کی مسجد میں امیر کی نمازِ جنازہ ادا کی گئی۔ ویئرہاؤس کے ساتھی اپنی یونیفارم میں آئے۔ ہم ممنون ہیں۔',
       now() - interval '5 days'
  from campaigns c where c.slug = 'demo-bringing-amir-home';

commit;
