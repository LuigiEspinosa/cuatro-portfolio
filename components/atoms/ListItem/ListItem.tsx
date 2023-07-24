import Link from 'next/link';
import Image from 'next/image';
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
              <Image src={cover} alt={coverAlt} width='432' height='540' />
            </div>

            <Image src={logo} alt={logoAlt} className='card-logo' width='245' height='45' />
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
