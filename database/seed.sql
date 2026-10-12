DELETE FROM books a
USING books b
WHERE a.id > b.id
  AND lower(a.title) = lower(b.title)
  AND lower(a.author) = lower(b.author);


INSERT INTO books
(
    title,
    author,
    description,
    category,
    genre,
    language,
    publication_year,
    page_count,
    price,
    currency,
    is_free,
    cover_image
)
VALUES
(
    'Atomic Habits',
    'James Clear',
    'A practical guide to building good habits and breaking bad ones.',
    'Self-Help',
    'Productivity',
    'English',
    2018,
    320,
    499,
    'INR',
    FALSE,
    'https://covers.openlibrary.org/b/isbn/9780141034354-L.jpg'
),
(
    'The Psychology of Money',
    'Morgan Housel',
    'Timeless lessons on wealth, greed, risk and human behavior.',
    'Finance',
    'Psychology',
    'English',
    2020,
    256,
    399,
    'INR',
    FALSE,
    'https://covers.openlibrary.org/b/isbn/9780857197689-L.jpg'
),
(
    'Pride and Prejudice',
    'Jane Austen',
    'A classic novel of manners, love and social expectations.',
    'Fiction',
    'Romance',
    'English',
    1813,
    432,
    0,
    'INR',
    TRUE,
    'https://covers.openlibrary.org/b/isbn/9780141439518-L.jpg'
),
(
    'Frankenstein',
    'Mary Shelley',
    'A landmark Gothic novel exploring ambition, responsibility and isolation.',
    'Fiction',
    'Gothic',
    'English',
    1818,
    280,
    0,
    'INR',
    TRUE,
    'https://covers.openlibrary.org/b/isbn/9780141439471-L.jpg'
),
(
    'The Time Machine',
    'H. G. Wells',
    'A pioneering science-fiction journey through humanity and time.',
    'Science Fiction',
    'Time Travel',
    'English',
    1895,
    118,
    0,
    'INR',
    TRUE,
    'https://covers.openlibrary.org/b/isbn/9780451528551-L.jpg'
),
(
    'The Adventures of Sherlock Holmes',
    'Arthur Conan Doyle',
    'Classic detective stories featuring Sherlock Holmes and Dr. Watson.',
    'Mystery',
    'Detective',
    'English',
    1892,
    307,
    0,
    'INR',
    TRUE,
    'https://covers.openlibrary.org/b/isbn/9780140439071-L.jpg'
),
(
    'Meditations',
    'Marcus Aurelius',
    'Stoic reflections on discipline, perspective and living well.',
    'Philosophy',
    'Stoicism',
    'English',
    NULL,
    254,
    249,
    'INR',
    FALSE,
    'https://covers.openlibrary.org/b/isbn/9780140449334-L.jpg'
),
(
    'Deep Work',
    'Cal Newport',
    'Strategies for focused work in a distracted world.',
    'Self-Help',
    'Productivity',
    'English',
    2016,
    304,
    449,
    'INR',
    FALSE,
    'https://covers.openlibrary.org/b/isbn/9781455586691-L.jpg'
)
ON CONFLICT (lower(title), lower(author))
DO NOTHING;