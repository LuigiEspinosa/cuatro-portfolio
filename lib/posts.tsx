import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { remark } from 'remark';
import html from 'remark-html';

const postDirectory = path.join(process.cwd(), 'blogposts');

export const getSortedPostsData = () => {
  const fileNames = fs.readdirSync(postDirectory);

  const allPostsData = fileNames.map((fileName) => {
    const id = fileName.replace(/\.md$/, '');
    const fullPath = path.join(postDirectory, fileName);
    const fileContents = fs.readFileSync(fullPath, 'utf8');
    const matterResult = matter(fileContents);

    const blogPost: BlogPost = {
      id,
      cover: matterResult.data.cover,
      coverAlt: matterResult.data.coverAlt,
      logo: matterResult.data.logo,
      logoAlt: matterResult.data.logoAlt,
      date: matterResult.data.date,
      title: matterResult.data.title,
    };

    return blogPost;
  });

  return allPostsData.sort((a, b) => (a.date < b.date ? 1 : -1));
};

export const getPostsData = async (id: string) => {
  const fullPath = path.join(postDirectory, `${id}.md`);
  const fileContents = fs.readFileSync(fullPath, 'utf8');

  const matterResult = matter(fileContents);
  const processedContent = await remark().use(html).process(matterResult.content);
  const contentHTML = processedContent.toString();

  const blogPostWithHTML: BlogPost & { contentHTML: string } = {
    id,
    cover: matterResult.data.cover,
    coverAlt: matterResult.data.coverAlt,
    logo: matterResult.data.logo,
    logoAlt: matterResult.data.logoAlt,
    date: matterResult.data.date,
    title: matterResult.data.title,
    contentHTML,
  };

  return blogPostWithHTML;
};
