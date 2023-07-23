import Link from 'next/link';
import getFormattedDate from '@/lib/getFormattedDate';
import './list-item.scss';

type Props = {
  post: BlogPost;
};

export default function ListItem({ post }: Props) {
  const { id, cover, coverAlt, logo, logoAlt, date, title } = post;
  const formattedDate = getFormattedDate(date);

  return (
    <li className='list-item' key={id}>
      <div className='list-card'>
        <Link href={`/blog/${id}`}>
          <div className='card-hero'>
            <div className='card-cover'>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cover} alt={coverAlt} width='432' height='540' />
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logo} alt={logoAlt} className='card-logo' />
          </div>

          <div className='card-content'>
            <h3 className='card-date'>
              <span>{formattedDate}</span>
            </h3>
            <p className='card-title'>{title}</p>
          </div>
        </Link>
      </div>
    </li>
  );
}
